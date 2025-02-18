import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { maxSatisfying } from 'semver';
import tar, { Pack } from 'tar';
import temp from 'temp';
import {
  PackageLoadError,
  CurrentPackageLoadError,
  IncorrectWildcardVersionFormatError
} from './errors';
import { FHIRDefinitions } from './FHIRDefinitions';
import { LogFunction } from './utils';
import { axiosGet } from './utils/axiosUtils';
import { getCustomRegistry } from './utils/customRegistry';
import { AxiosResponse } from 'axios';
import { LatestVersionUnavailableError } from './errors/LatestVersionUnavailableError';

class PackageCache {
  public static lastCurrentUpdate: Date;
  private static cache: { [pkg: string]: LoadedPackage } = {};

  public static isCurrentPackageRefreshNeeded(): boolean {
    return (
      !PackageCache.lastCurrentUpdate ||
      PackageCache.lastCurrentUpdate.getTime() - new Date().getTime() > 86400000
    );
  }

  public static markCurrentPackageRefreshed(): void {
    this.lastCurrentUpdate = new Date();
  }

  static contains(pkg: string): boolean {
    return !!this.cache[pkg];
  }

  static get(pkg: string): LoadedPackage {
    return this.cache[pkg];
  }

  static put(pkg: string, loadedPackage: LoadedPackage): void {
    this.cache[pkg] = loadedPackage;
  }
}

class LoadedPackage {
  package: string;
  defs: any[] = [];
  packageJson: any;
}

async function getDistUrl(registry: string, packageName: string, version: string): Promise<string> {
  const cleanedRegistry = registry.replace(/\/$/, '');
  // 1 get the manifest information about the package from the registry
  const res = await axiosGet(`${cleanedRegistry}/${packageName}`);
  // 2 find the NPM tarball location
  const npmLocation = res.data?.versions?.[version]?.dist?.tarball;

  // 3 if found, use it, otherwise fallback to the FHIR spec location
  if (npmLocation) {
    return npmLocation;
  } else {
    return `${cleanedRegistry}/${packageName}/${version}`;
  }
}

/**
 * Loads multiple dependencies from a directory (the user FHIR cache or a specified directory) or from online
 * @param {string[]} fhirPackages - An array of FHIR packages to download and load definitions from (format: packageId#version)
 * @param {string} [cachePath=path.join(os.homedir(), '.fhir', 'packages')] - Path to look for the package and download to if not already present. Defaults to local FHIR cache.
 * @param {LogFunction} [log=() => {}] - A function for logging. Defaults to no-op.
 * @returns {Promise<FHIRDefinitions>} the loaded FHIRDefinitions
 */
export async function loadDependencies(
  fhirPackages: string[],
  cachePath: string = path.join(os.homedir(), '.fhir', 'packages'),
  log: LogFunction = () => {}
): Promise<FHIRDefinitions> {
  const promises = fhirPackages.map(fhirPackage => {
    const [fhirPackageId, fhirPackageVersion] = fhirPackage.split('#');
    const fhirDefs = new FHIRDefinitions();
    // Testing Hack: Use exports.mergeDependency instead of mergeDependency so that this function
    // calls the mocked mergeDependency in unit tests.  In normal (non-test) use, this should
    // have no negative effects.
    return exports
      .mergeDependency(fhirPackageId, fhirPackageVersion, fhirDefs, cachePath, log)
      .catch((e: Error) => {
        let message = `Failed to load ${fhirPackageId}#${fhirPackageVersion}: ${e.message}`;
        if (/certificate/.test(e.message)) {
          message +=
            '\n\nSometimes this error occurs in corporate or educational environments that use proxies and/or SSL ' +
            'inspection.\nTroubleshooting tips:\n' +
            '  1. If a non-proxied network is available, consider connecting to that network instead.\n' +
            '  2. Set NODE_EXTRA_CA_CERTS as described at https://bit.ly/3ghJqJZ (RECOMMENDED).\n' +
            '  3. Disable certificate validation as described at https://bit.ly/3syjzm7 (NOT RECOMMENDED).\n';
        }
        log('error', message);
        fhirDefs.unsuccessfulPackageLoad = true;
        fhirDefs.package = `${fhirPackageId}#${fhirPackageVersion}`;
        return fhirDefs;
      });
  });
  return await Promise.all(promises).then(fhirDefs => {
    if (fhirDefs.length > 1) {
      const mainFHIRDefs = new FHIRDefinitions();
      fhirDefs.forEach(d => mainFHIRDefs.childFHIRDefs.push(d));
      return mainFHIRDefs;
    }
    return fhirDefs[0];
  });
}

/**
 * Downloads a dependency from a directory (the user FHIR cache or a specified directory) or from online.
 * The definitions from the package are added to their own FHIRDefinitions instance, which is then added to
 * the provided FHIRDefs childDefs. If the provided FHIRDefs does not yet have any children, a wrapper FHIRDefinitions
 * instance is created and both the original packages and the new package are added to childDefs.
 * @param {string} packageName - The name of the package to load
 * @param {string} version - The version of the package to load
 * @param {FHIRDefinitions} FHIRDefs - The FHIRDefinitions to load the dependencies into
 * @param {string} [cachePath=path.join(os.homedir(), '.fhir', 'packages')] - The path to load the package into (default: user FHIR cache)
 * @returns {Promise<FHIRDefinitions>} the loaded FHIRDefs
 * @throws {PackageLoadError} when the desired package can't be loaded
 */
export async function loadDependency(
  packageName: string,
  version: string,
  FHIRDefs: FHIRDefinitions,
  cachePath: string = path.join(os.homedir(), '.fhir', 'packages'),
  log: LogFunction = () => {}
): Promise<FHIRDefinitions> {
  const newFHIRDefs = new FHIRDefinitions();
  // Testing Hack: Use exports.mergeDependency instead of mergeDependency so that this function
  // calls the mocked mergeDependency in unit tests.  In normal (non-test) use, this should
  // have no negative effects.
  await exports.mergeDependency(packageName, version, newFHIRDefs, cachePath, log);
  if (FHIRDefs.childFHIRDefs.length === 0) {
    const wrapperFHIRDefs = new FHIRDefinitions();
    wrapperFHIRDefs.childFHIRDefs.push(FHIRDefs, newFHIRDefs);
    return wrapperFHIRDefs;
  }
  FHIRDefs.childFHIRDefs.push(newFHIRDefs);
  return FHIRDefs;
}

/**
 * Downloads a dependency from a directory (the user FHIR cache or a specified directory) or from online
 * and then loads it into the FHIRDefinitions class provided
 * Note: You likely want to use loadDependency, which adds the package to its own FHIRDefinitions class instance
 * before appending that package to the provided FHIRDefinitions.childDefs array. This maintains the same structure
 * that is created with loadDependencies.
 * @param {string} packageName - The name of the package to load
 * @param {string} version - The version of the package to load
 * @param {FHIRDefinitions} FHIRDefs - The FHIRDefinitions to load the dependencies into
 * @param {string} [cachePath=path.join(os.homedir(), '.fhir', 'packages')] - The path to load the package into (default: user FHIR cache)
 * @returns {Promise<FHIRDefinitions>} the loaded FHIRDefs
 * @throws {PackageLoadError} when the desired package can't be loaded
 */
export async function mergeDependency(
  packageName: string,
  version: string,
  FHIRDefs: FHIRDefinitions,
  cachePath: string = path.join(os.homedir(), '.fhir', 'packages'),
  log: LogFunction = () => {}
): Promise<FHIRDefinitions> {
  if (version === 'latest') {
    // using the exported function here to allow for easier mocking in tests
    version = await exports.lookUpLatestVersion(packageName, log);
  } else if (/^\d+\.\d+\.x$/.test(version)) {
    // using the exported function here to allow for easier mocking in tests
    version = await exports.lookUpLatestPatchVersion(packageName, version, log);
  } else if (/^\d+\.x$/.test(version)) {
    throw new IncorrectWildcardVersionFormatError(packageName, version);
  }
  let fullPackageName = `${packageName}#${version}`;
  const loadPath = path.join(cachePath, fullPackageName, 'package');
  let loadedPackage: LoadedPackage;

  // First, try to load the package from the local cache
  log('info', `Checking ${cachePath} for ${fullPackageName}...`);
  loadedPackage = loadFromPath(cachePath, fullPackageName);
  if (loadedPackage) {
    log('info', `Found ${fullPackageName} in ${cachePath}.`);
  } else {
    log('info', `Did not find ${fullPackageName} in ${cachePath}.`);
  }

  // When a dev package is not present locally, fall back to using the current version
  // as described here https://confluence.hl7.org/pages/viewpage.action?pageId=35718627#IGPublisherDocumentation-DependencyList
  if (version === 'dev' && !loadedPackage) {
    log(
      'info',
      `Falling back to ${packageName}#current since ${fullPackageName} is not locally cached. To avoid this, add ${fullPackageName} to your local FHIR cache by building it locally with the HL7 FHIR IG Publisher.`
    );
    version = 'current';
    fullPackageName = `${packageName}#${version}`;
    loadedPackage = loadFromPath(cachePath, fullPackageName);
  }

  let packageUrl;
  if (packageName.startsWith('hl7.fhir.r5.') && version === 'current') {
    packageUrl = `https://build.fhir.org/${packageName}.tgz`;
    // TODO: Figure out how to determine if the cached package is current
    // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/Registry.20for.20FHIR.20Core.20packages.20.3E.204.2E0.2E1
    if (loadedPackage) {
      log(
        'info',
        `Downloading ${fullPackageName} since FHIR Package Loader cannot determine if the version in ${cachePath} is the most recent build.`
      );
    }
  } else if (/^current(\$.+)?$/.test(version)) {
    if (PackageCache.isCurrentPackageRefreshNeeded()) {
      PackageCache.markCurrentPackageRefreshed();
      // Authors can reference a specific CI branch by specifying version as current${branchname} (e.g., current$mybranch)
      // See: https://chat.fhir.org/#narrow/stream/179166-implementers/topic/Package.20cache.20-.20multiple.20dev.20versions/near/291131585
      let branch: string;
      if (version.indexOf('$') !== -1) {
        branch = version.slice(version.indexOf('$') + 1);
      }

      // Even if a local current package is loaded, we must still check that the local package date matches
      // the date on the most recent version on build.fhir.org. If the date does not match, we re-download to the cache
      type QAEntry = { 'package-id': string; date: string; repo: string };
      const baseUrl = 'https://build.fhir.org/ig';
      const res = await axiosGet(`${baseUrl}/qas.json`);
      const qaData: QAEntry[] = res?.data;
      // Find matching packages and sort by date to get the most recent
      let newestPackage: QAEntry;
      if (qaData?.length > 0) {
        let matchingPackages = qaData.filter(p => p['package-id'] === packageName);
        if (branch == null) {
          matchingPackages = matchingPackages.filter(p =>
            p.repo.match(/\/(master|main)\/qa\.json$/)
          );
        } else {
          matchingPackages = matchingPackages.filter(p => p.repo.endsWith(`/${branch}/qa.json`));
        }
        newestPackage = matchingPackages.sort((p1, p2) => {
          return Date.parse(p2['date']) - Date.parse(p1['date']);
        })[0];
      }
      if (newestPackage?.repo) {
        const packagePath = newestPackage.repo.slice(0, -8); // remove "/qa.json" from end
        const igUrl = `${baseUrl}/${packagePath}`;
        // get the package.manifest.json for the newest version of the package on build.fhir.org
        const manifest = await axiosGet(`${igUrl}/package.manifest.json`);
        let cachedPackageJSON;
        if (fs.existsSync(path.join(loadPath, 'package.json'))) {
          cachedPackageJSON = fs.readJSONSync(path.join(loadPath, 'package.json'));
        }
        // if the date on the package.manifest.json does not match the date on the cached package
        // set the packageUrl to trigger a re-download of the package
        if (manifest?.data?.date !== cachedPackageJSON?.date) {
          packageUrl = `${igUrl}/package.tgz`;
          if (cachedPackageJSON) {
            log(
              'debug',
              `Cached package date for ${fullPackageName} (${formatDate(
                cachedPackageJSON.date
              )}) does not match last build date on build.fhir.org (${formatDate(
                manifest?.data?.date
              )})`
            );
            log(
              'info',
              `Cached package ${fullPackageName} is out of date and will be replaced by the more recent version found on build.fhir.org.`
            );
          }
        } else {
          log(
            'debug',
            `Cached package date for ${fullPackageName} (${formatDate(
              cachedPackageJSON.date
            )}) matches last build date on build.fhir.org (${formatDate(
              manifest?.data?.date
            )}), so the cached package will be used`
          );
        }
      } else {
        throw new CurrentPackageLoadError(fullPackageName);
      }
    }
  } else if (!loadedPackage) {
    const customRegistry = getCustomRegistry(log);
    if (customRegistry) {
      packageUrl = await getDistUrl(customRegistry, packageName, version);
    } else {
      packageUrl = `https://packages.fhir.org/${packageName}/${version}`;
    }
  }

  // If the packageUrl is set, we must download the package from that url, and extract it to our local cache
  if (packageUrl) {
    const doDownload = async (url: string) => {
      log('info', `Downloading ${fullPackageName}... ${url}`);
      const res = await axiosGet(url, {
        responseType: 'arraybuffer'
      });
      if (res?.data) {
        log('info', `Downloaded ${fullPackageName}`);
        // Create a temporary file and write the package to there
        temp.track();
        const tempFile = temp.openSync();
        fs.writeFileSync(tempFile.path, res.data);
        // Extract the package to a temporary directory
        const tempDirectory = temp.mkdirSync();
        tar.x({
          cwd: tempDirectory,
          file: tempFile.path,
          sync: true,
          strict: true
        });
        cleanCachedPackage(tempDirectory);
        // Add or replace the package in the FHIR cache
        const targetDirectory = path.join(cachePath, fullPackageName);
        if (fs.existsSync(targetDirectory)) {
          fs.removeSync(targetDirectory);
        }
        fs.moveSync(tempDirectory, targetDirectory);
        // Now try to load again from the path
        loadedPackage = loadFromPath(cachePath, fullPackageName);
      } else {
        log('info', `Unable to download most current version of ${fullPackageName}`);
      }
    };
    try {
      await doDownload(packageUrl);
    } catch (e) {
      if (packageUrl === `https://packages.fhir.org/${packageName}/${version}`) {
        // It didn't exist in the normal registry.  Fallback to packages2 registry.
        // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/Registry.20for.20FHIR.20Core.20packages.20.3E.204.2E0.2E1
        // See: https://chat.fhir.org/#narrow/stream/179252-IG-creation/topic/fhir.2Edicom/near/262334652
        packageUrl = `https://packages2.fhir.org/packages/${packageName}/${version}`;
        try {
          await doDownload(packageUrl);
        } catch (e) {
          throw new PackageLoadError(fullPackageName);
        }
      } else {
        throw new PackageLoadError(fullPackageName, getCustomRegistry());
      }
    }
  }

  if (!loadedPackage) {
    // If we fail again, then we couldn't get the package locally or from online
    throw new PackageLoadError(fullPackageName, getCustomRegistry());
  }

  merge(loadedPackage, FHIRDefs);
  log('info', `Loaded package ${fullPackageName}`);
  return FHIRDefs;
}

/**
 * This function takes a package which contains contents at the same level as the "package" folder, and nests
 * all that content within the "package" folder.
 *
 * A package should have the format described here https://confluence.hl7.org/pages/viewpage.action?pageId=35718629#NPMPackageSpecification-Format
 * in which all contents are within the "package" folder. Some packages (ex US Core 3.1.0) have an incorrect format in which folders
 * are not sub-folders of "package", but are instead at the same level. The IG Publisher fixes these packages as described
 * https://chat.fhir.org/#narrow/stream/215610-shorthand/topic/dev.20dependencies, so we should as well.
 *
 * @param {string} packageDirectory - The directory containing the package
 */
export function cleanCachedPackage(packageDirectory: string): void {
  if (fs.existsSync(path.join(packageDirectory, 'package'))) {
    fs.readdirSync(packageDirectory)
      .filter(file => file !== 'package')
      .forEach(file => {
        fs.renameSync(
          path.join(packageDirectory, file),
          path.join(packageDirectory, 'package', file)
        );
      });
  }
}

export function merge(pkg: LoadedPackage, defs: FHIRDefinitions): void {
  pkg.defs.forEach(d => defs.add(d));
  defs.addPackageJson(pkg.package, pkg.packageJson);
  defs.package = pkg.package;
}

/**
 * Locates the targetPackage within the cachePath
 * @param {string} cachePath - The path to the directory containing cached packages
 * @param {string} targetPackage - The name of the package we are trying to load
 * @returns {LoadedPackage} loaded package definitions
 */
export function loadFromPath(cachePath: string, targetPackage: string): LoadedPackage {
  if (PackageCache.contains(targetPackage)) {
    return PackageCache.get(targetPackage);
  }
  const packages = fs.existsSync(cachePath) ? fs.readdirSync(cachePath) : [];
  const cachedPackage = packages.find(packageName => packageName.toLowerCase() === targetPackage);
  if (!cachedPackage) {
    return null;
  }
  const result = new LoadedPackage();
  result.package = targetPackage;
  fs.readdirSync(path.join(cachePath, cachedPackage, 'package'))
    .filter(file => file.endsWith('.json'))
    .forEach(file => {
      const def = JSON.parse(
        fs.readFileSync(path.join(cachePath, cachedPackage, 'package', file), 'utf-8').trim()
      );
      result.defs.push(def);
      if (file === 'package.json') {
        result.packageJson = def;
      }
    });
  PackageCache.put(targetPackage, result);
  return result;
}

export async function lookUpLatestVersion(
  packageName: string,
  log: LogFunction = () => {}
): Promise<string> {
  const customRegistry = getCustomRegistry(log);
  let res: AxiosResponse;
  try {
    if (customRegistry) {
      res = await axiosGet(`${customRegistry.replace(/\/$/, '')}/${packageName}`, {
        responseType: 'json'
      });
    } else {
      try {
        res = await axiosGet(`https://packages.fhir.org/${packageName}`, {
          responseType: 'json'
        });
      } catch (e) {
        // Fallback to trying packages2.fhir.org
        res = await axiosGet(`https://packages2.fhir.org/packages/${packageName}`, {
          responseType: 'json'
        });
      }
    }
  } catch {
    throw new LatestVersionUnavailableError(packageName, customRegistry);
  }

  if (res?.data?.['dist-tags']?.latest?.length) {
    return res.data['dist-tags'].latest;
  } else {
    throw new LatestVersionUnavailableError(packageName, customRegistry);
  }
}

export async function lookUpLatestPatchVersion(
  packageName: string,
  version: string,
  log: LogFunction = () => {}
): Promise<string> {
  if (!/^\d+\.\d+\.x$/.test(version)) {
    throw new IncorrectWildcardVersionFormatError(packageName, version);
  }
  const customRegistry = getCustomRegistry(log);
  let res: AxiosResponse;
  try {
    if (customRegistry) {
      res = await axiosGet(`${customRegistry.replace(/\/$/, '')}/${packageName}`, {
        responseType: 'json'
      });
    } else {
      try {
        res = await axiosGet(`https://packages.fhir.org/${packageName}`, {
          responseType: 'json'
        });
      } catch (e) {
        // Fallback to trying packages2.fhir.org
        res = await axiosGet(`https://packages2.fhir.org/packages/${packageName}`, {
          responseType: 'json'
        });
      }
    }
  } catch {
    throw new LatestVersionUnavailableError(packageName, customRegistry, true);
  }

  if (res?.data?.versions) {
    const versions = Object.keys(res.data.versions);
    const latest = maxSatisfying(versions, version);
    if (latest == null) {
      throw new LatestVersionUnavailableError(packageName, customRegistry, true);
    }
    return latest;
  } else {
    throw new LatestVersionUnavailableError(packageName, customRegistry, true);
  }
}

/**
 * Takes a date in format YYYYMMDDHHmmss and converts to YYYY-MM-DDTHH:mm:ss
 * @param {string} date - The date to format
 * @returns {string} the formatted date
 */
function formatDate(date: string): string {
  return date
    ? date.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')
    : '';
}

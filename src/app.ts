#!/usr/bin/env node

import { program } from 'commander';
import { loadDependencies } from './loadUtils';
import { logger } from './utils';

async function myApp() {
  program
    .name('fhir-package-load')
    .usage('<fhirPackages...> [options]')
    .option(
      '-s, --save <dir>',
      'where to save packages to and load definitions from (default is the local FHIR cache)'
    )
    .option('-d, --debug', 'output extra debugging information')
    .argument(
      '<fhirPackages...>',
      'list of FHIR packages to load using the format packageId@packageVersion...'
    )
    .addHelpText(
      'after',
      `
Examples:
  npx fhir-package-load hl7.fhir.r5.core@current
  fhir-package-load hl7.fhir.r4.core@4.0.1 hl7.fhir.us.core@4.0.0 --save ./myProject`
    )
    .version('0.1.0', '-v, --version') // Use -v (instead of default -V)
    .parse(process.argv);

  if (program.opts().debug) logger.level = 'debug';

  const packages = program.args.map(dep => dep.replace('@', '#'));
  const cachePath = program.opts().save;

  await loadDependencies(packages, cachePath);
}

myApp();

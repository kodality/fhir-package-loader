import path from 'path';
import { loadFromPath, merge } from '../src/load';
import { FHIRDefinitions, Type } from '../src/FHIRDefinitions';
import { loggerSpy } from './testhelpers';

describe('FHIRDefinitions', () => {
  let defs: FHIRDefinitions;
  beforeAll(() => {
    defs = new FHIRDefinitions();
    merge(loadFromPath(path.join(__dirname, 'testhelpers', 'testdefs'), 'r4-definitions'), defs);
  });

  beforeEach(() => {
    loggerSpy.reset();
  });

  describe('#fishForFHIR()', () => {
    it('should find base FHIR resources', () => {
      const conditionByID = defs.fishForFHIR('Condition', Type.Resource);
      expect(conditionByID.url).toBe('http://hl7.org/fhir/StructureDefinition/Condition');
      expect(conditionByID.fhirVersion).toBe('4.0.1');
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/Condition', Type.Resource)
      ).toEqual(conditionByID);
    });

    it('should find base FHIR logical models', () => {
      const eLTSSServiceModelByID = defs.fishForFHIR('eLTSSServiceModel', Type.Logical);
      expect(eLTSSServiceModelByID.url).toBe(
        'http://hl7.org/fhir/us/eltss/StructureDefinition/eLTSSServiceModel'
      );
      expect(eLTSSServiceModelByID.version).toBe('0.1.0');
      expect(
        defs.fishForFHIR(
          'http://hl7.org/fhir/us/eltss/StructureDefinition/eLTSSServiceModel',
          Type.Logical
        )
      ).toEqual(eLTSSServiceModelByID);
    });

    it('should find base FHIR primitive types', () => {
      const booleanByID = defs.fishForFHIR('boolean', Type.Type);
      expect(booleanByID.url).toBe('http://hl7.org/fhir/StructureDefinition/boolean');
      expect(booleanByID.fhirVersion).toBe('4.0.1');
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/boolean', Type.Type)
      ).toEqual(booleanByID);
    });

    it('should find base FHIR complex types', () => {
      const addressByID = defs.fishForFHIR('Address', Type.Type);
      expect(addressByID.url).toBe('http://hl7.org/fhir/StructureDefinition/Address');
      expect(addressByID.fhirVersion).toBe('4.0.1');
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/Address', Type.Type)
      ).toEqual(addressByID);
    });

    it('should find base FHIR profiles', () => {
      const vitalSignsByID = defs.fishForFHIR('vitalsigns', Type.Profile);
      expect(vitalSignsByID.url).toBe('http://hl7.org/fhir/StructureDefinition/vitalsigns');
      expect(vitalSignsByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('observation-vitalsigns', Type.Profile)).toEqual(vitalSignsByID);
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/vitalsigns', Type.Profile)
      ).toEqual(vitalSignsByID);
    });

    it('should find base FHIR profiles of logical models', () => {
      const serviceProfileByID = defs.fishForFHIR('service-profile', Type.Profile);
      expect(serviceProfileByID.url).toBe(
        'http://hl7.org/fhir/some/example/StructureDefinition/ServiceProfile'
      );
      expect(serviceProfileByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('ServiceProfile', Type.Profile)).toEqual(serviceProfileByID);
      expect(
        defs.fishForFHIR(
          'http://hl7.org/fhir/some/example/StructureDefinition/ServiceProfile',
          Type.Profile
        )
      ).toEqual(serviceProfileByID);
    });

    it('should find base FHIR extensions', () => {
      const maidenNameExtensionByID = defs.fishForFHIR('patient-mothersMaidenName', Type.Extension);
      expect(maidenNameExtensionByID.url).toBe(
        'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName'
      );
      expect(maidenNameExtensionByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('mothersMaidenName', Type.Extension)).toEqual(
        maidenNameExtensionByID
      );
      expect(
        defs.fishForFHIR(
          'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName',
          Type.Extension
        )
      ).toEqual(maidenNameExtensionByID);
    });

    it('should find base FHIR value sets', () => {
      const allergyStatusValueSetByID = defs.fishForFHIR(
        'allergyintolerance-clinical',
        Type.ValueSet
      );
      expect(allergyStatusValueSetByID.url).toBe(
        'http://hl7.org/fhir/ValueSet/allergyintolerance-clinical'
      );
      // For some reason, value sets don't specify a fhirVersion, but in this case the business
      // version is the FHIR version, so we'll verify that instead
      expect(allergyStatusValueSetByID.version).toBe('4.0.1');
      expect(defs.fishForFHIR('AllergyIntoleranceClinicalStatusCodes', Type.ValueSet)).toEqual(
        allergyStatusValueSetByID
      );
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/ValueSet/allergyintolerance-clinical', Type.ValueSet)
      ).toEqual(allergyStatusValueSetByID);
    });

    it('should find base FHIR code systems', () => {
      // Surprise!  It turns out that the AllergyIntolerance status value set and code system
      // have the same ID!
      const allergyStatusCodeSystemByID = defs.fishForFHIR(
        'allergyintolerance-clinical',
        Type.CodeSystem
      );
      expect(allergyStatusCodeSystemByID.url).toBe(
        'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical'
      );
      // For some reason, code systems don't specify a fhirVersion, but in this case the business
      // version is the FHIR version, so we'll verify that instead
      expect(allergyStatusCodeSystemByID.version).toBe('4.0.1');
      expect(defs.fishForFHIR('AllergyIntoleranceClinicalStatusCodes', Type.CodeSystem)).toEqual(
        allergyStatusCodeSystemByID
      );
      expect(
        defs.fishForFHIR(
          'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          Type.CodeSystem
        )
      ).toEqual(allergyStatusCodeSystemByID);
    });

    it('should find definitions by the type order supplied', () => {
      // NOTE: There are two things with id allergyintolerance-clinical (the ValueSet and CodeSystem)
      const allergyStatusValueSetByID = defs.fishForFHIR(
        'allergyintolerance-clinical',
        Type.ValueSet,
        Type.CodeSystem
      );
      expect(allergyStatusValueSetByID.resourceType).toBe('ValueSet');

      const allergyStatusCodeSystemByID = defs.fishForFHIR(
        'allergyintolerance-clinical',
        Type.CodeSystem,
        Type.ValueSet
      );
      expect(allergyStatusCodeSystemByID.resourceType).toBe('CodeSystem');
    });

    it('should not find the definition when the type is not requested', () => {
      const conditionByID = defs.fishForFHIR(
        'Condition',
        Type.Logical,
        Type.Type,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.CodeSystem,
        Type.Instance
      );
      expect(conditionByID).toBeUndefined();

      const booleanByID = defs.fishForFHIR(
        'boolean',
        Type.Resource,
        Type.Logical,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.CodeSystem,
        Type.Instance
      );
      expect(booleanByID).toBeUndefined();

      const addressByID = defs.fishForFHIR(
        'Address',
        Type.Resource,
        Type.Logical,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.CodeSystem,
        Type.Instance
      );
      expect(addressByID).toBeUndefined();

      const vitalSignsProfileByID = defs.fishForFHIR(
        'vitalsigns',
        Type.Resource,
        Type.Logical,
        Type.Type,
        Type.Extension,
        Type.ValueSet,
        Type.CodeSystem,
        Type.Instance
      );
      expect(vitalSignsProfileByID).toBeUndefined();

      const maidenNameExtensionByID = defs.fishForFHIR(
        'patient-mothersMaidenName',
        Type.Resource,
        Type.Logical,
        Type.Type,
        Type.Profile,
        Type.ValueSet,
        Type.CodeSystem,
        Type.Instance
      );
      expect(maidenNameExtensionByID).toBeUndefined();

      // NOTE: There are two things with id allergyintolerance-clinical (the ValueSet and CodeSystem)
      const allergyStatusValueSetByID = defs.fishForFHIR(
        'allergyintolerance-clinical',
        Type.Resource,
        Type.Logical,
        Type.Type,
        Type.Profile,
        Type.Extension,
        Type.Instance
      );
      expect(allergyStatusValueSetByID).toBeUndefined();

      const w3cProvenanceCodeSystemByID = defs.fishForFHIR(
        'w3c-provenance-activity-type',
        Type.Resource,
        Type.Logical,
        Type.Type,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.Instance
      );
      expect(w3cProvenanceCodeSystemByID).toBeUndefined();

      const eLTSSServiceModelByID = defs.fishForFHIR(
        'eLTSSServiceModel',
        Type.Resource,
        Type.Type,
        Type.Profile,
        Type.Extension,
        Type.ValueSet,
        Type.Instance
      );
      expect(eLTSSServiceModelByID).toBeUndefined();
    });

    it('should globally find any definition', () => {
      const conditionByID = defs.fishForFHIR('Condition');
      expect(conditionByID.kind).toBe('resource');
      expect(conditionByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/Condition')).toEqual(
        conditionByID
      );

      const booleanByID = defs.fishForFHIR('boolean');
      expect(booleanByID.kind).toBe('primitive-type');
      expect(booleanByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/boolean')).toEqual(
        booleanByID
      );

      const addressByID = defs.fishForFHIR('Address');
      expect(addressByID.kind).toBe('complex-type');
      expect(addressByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/Address')).toEqual(
        addressByID
      );

      const vitalSignsProfileByID = defs.fishForFHIR('vitalsigns');
      expect(vitalSignsProfileByID.type).toBe('Observation');
      expect(vitalSignsProfileByID.kind).toBe('resource');
      expect(vitalSignsProfileByID.derivation).toBe('constraint');
      expect(vitalSignsProfileByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('observation-vitalsigns')).toEqual(vitalSignsProfileByID);
      expect(defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/vitalsigns')).toEqual(
        vitalSignsProfileByID
      );

      const maidenNameExtensionByID = defs.fishForFHIR('patient-mothersMaidenName');
      expect(maidenNameExtensionByID.type).toBe('Extension');
      expect(maidenNameExtensionByID.fhirVersion).toBe('4.0.1');
      expect(defs.fishForFHIR('mothersMaidenName')).toEqual(maidenNameExtensionByID);
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName')
      ).toEqual(maidenNameExtensionByID);

      // NOTE: There are two things with id allergyintolerance-clinical (the ValueSet and CodeSystem)
      // When doing a non-type-specific search, we favor the ValueSet
      const allergyStatusValueSetByID = defs.fishForFHIR('allergyintolerance-clinical');
      expect(allergyStatusValueSetByID.resourceType).toBe('ValueSet');
      // For some reason, value sets don't specify a fhirVersion, but in this case the business
      // version is the FHIR version, so we'll verify that instead
      expect(allergyStatusValueSetByID.version).toBe('4.0.1');
      expect(defs.fishForFHIR('AllergyIntoleranceClinicalStatusCodes')).toEqual(
        allergyStatusValueSetByID
      );
      expect(defs.fishForFHIR('http://hl7.org/fhir/ValueSet/allergyintolerance-clinical')).toEqual(
        allergyStatusValueSetByID
      );

      const w3cProvenanceCodeSystemByID = defs.fishForFHIR('w3c-provenance-activity-type');
      expect(w3cProvenanceCodeSystemByID.resourceType).toBe('CodeSystem');
      // For some reason, code systems don't specify a fhirVersion, but in this case the business
      // version is the FHIR version, so we'll verify that instead
      expect(w3cProvenanceCodeSystemByID.version).toBe('4.0.1');
      expect(defs.fishForFHIR('W3cProvenanceActivityType')).toEqual(w3cProvenanceCodeSystemByID);
      expect(defs.fishForFHIR('http://hl7.org/fhir/w3c-provenance-activity-type')).toEqual(
        w3cProvenanceCodeSystemByID
      );

      const eLTSSServiceModelByID = defs.fishForFHIR('eLTSSServiceModel');
      expect(eLTSSServiceModelByID.kind).toBe('logical');
      expect(eLTSSServiceModelByID.derivation).toBe('specialization');
      expect(
        defs.fishForFHIR('http://hl7.org/fhir/us/eltss/StructureDefinition/eLTSSServiceModel')
      ).toEqual(eLTSSServiceModelByID);
    });

    it('should find definition in parent defs before searching in children', () => {
      const defsWithChildDefs = new FHIRDefinitions();

      // package1 does not contain a Condition resource
      const childDefs1 = new FHIRDefinitions();
      merge(loadFromPath(path.join(__dirname, 'testhelpers', 'testdefs'), 'package1'), childDefs1);
      childDefs1.package = 'package1';

      // package2 contains a Condition resource with version 4.0.2
      const childDefs2 = new FHIRDefinitions();
      merge(loadFromPath(path.join(__dirname, 'testhelpers', 'testdefs'), 'package2'), childDefs2);
      childDefs2.package = 'package2';

      // package3 contains a Condition resource with version 4.0.3
      const childDefs3 = new FHIRDefinitions();
      merge(loadFromPath(path.join(__dirname, 'testhelpers', 'testdefs'), 'package3'), childDefs3);
      childDefs3.package = 'package3';

      // childDefs1 and childDefs2 are siblings, childDef3 is child of childDef1
      childDefs1.childFHIRDefs.push(childDefs3);
      defsWithChildDefs.childFHIRDefs.push(childDefs1);
      defsWithChildDefs.childFHIRDefs.push(childDefs2);

      // fishForFHIR should find the first level child (childDefs2) Condition before
      // it finds the second level child (childDefs3) Condition
      const conditionByID = defsWithChildDefs.fishForFHIR('Condition', Type.Resource);
      expect(conditionByID.version).toEqual('4.0.2');
    });

    it('should find definitions when fished by id with version', () => {
      const vitalSignsById = defs.fishForFHIR('vitalsigns|4.0.1', Type.Profile);
      expect(vitalSignsById).toBeDefined();
      expect(vitalSignsById.name).toBe('observation-vitalsigns');
      expect(vitalSignsById.url).toBe('http://hl7.org/fhir/StructureDefinition/vitalsigns');
      expect(vitalSignsById.version).toBe('4.0.1');
    });

    it('should find definitions when fished by name with version', () => {
      const vitalSignsByName = defs.fishForFHIR('observation-vitalsigns|4.0.1', Type.Profile);
      expect(vitalSignsByName).toBeDefined();
      expect(vitalSignsByName.id).toBe('vitalsigns');
      expect(vitalSignsByName.url).toBe('http://hl7.org/fhir/StructureDefinition/vitalsigns');
      expect(vitalSignsByName.version).toBe('4.0.1');
    });

    it('should find definitions when fished by url with version', () => {
      const vitalSignsByUrl = defs.fishForFHIR(
        'http://hl7.org/fhir/StructureDefinition/vitalsigns|4.0.1',
        Type.Profile
      );
      expect(vitalSignsByUrl).toBeDefined();
      expect(vitalSignsByUrl.id).toBe('vitalsigns');
      expect(vitalSignsByUrl.name).toBe('observation-vitalsigns');
      expect(vitalSignsByUrl.version).toBe('4.0.1');
    });

    it('should find definitions with a version with | in the version', () => {
      const simpleProfileById = defs.fishForFHIR('SimpleProfile|1.0.0|a');
      expect(simpleProfileById).toBeDefined();
      expect(simpleProfileById.id).toBe('SimpleProfile');
      expect(simpleProfileById.name).toBe('SimpleProfile');
      expect(simpleProfileById.version).toBe('1.0.0|a');
    });

    it('should return nothing if a definition with matching version is not found', () => {
      const vitalSignsById = defs.fishForFHIR('vitalsigns|1.0.0', Type.Profile);
      const vitalSignsByName = defs.fishForFHIR('observation-vitalsigns|1.0.0', Type.Profile);
      const vitalSignsByUrl = defs.fishForFHIR(
        'http://hl7.org/fhir/StructureDefinition/vitalsigns|1.0.0',
        Type.Profile
      );
      expect(vitalSignsById).toBeUndefined();
      expect(vitalSignsByName).toBeUndefined();
      expect(vitalSignsByUrl).toBeUndefined();
    });

    it('should return nothing if a definition without a version is found when fishing with a version', () => {
      const simpleProfileById = defs.fishForFHIR('SimpleProfileNoVersion|1.0.0');
      expect(simpleProfileById).toBeUndefined();
    });
  });
});

const sinon = require('sinon');
const assert = require('assert').strict;
const { Ims } = require('@adobe/aio-lib-ims');
const inquirer = require('inquirer');
const Config = require('@adobe/aio-lib-core-config');
const {
  CloudSdkAPIBase,
} = require('../../../../src/lib/cloud-sdk-api-base.js');
const SetupCommand = require('../../../../src/commands/aem/rde/setup.js');

describe('SetupCommand - withCloudSdkBase', function () {
  let setupCommand;
  let mockFn;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    mockFn = sinon.stub();
    sinon
      .stub(setupCommand, 'getTokenAndKey')
      .resolves({ accessToken: 'testToken', apiKey: 'testKey' });
    sinon.stub(setupCommand, 'getBaseUrl').returns('testUrl');
    sinon.stub(setupCommand, 'getCliOrgId').returns('testOrgId');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should call getTokenAndKey if _cloudSdkAPIBase is not set', async function () {
    await setupCommand.withCloudSdkBase(mockFn);
    assert.ok(setupCommand.getTokenAndKey.called);
  });

  it('should correctly initialize _cloudSdkAPIBase when not set', async function () {
    await setupCommand.withCloudSdkBase(mockFn);
    assert.notStrictEqual(setupCommand._cloudSdkAPIBase, undefined);
    assert.strictEqual(
      setupCommand._cloudSdkAPIBase._cloudManagerClient._headers['x-api-key'],
      'testKey'
    );
  });

  it('should not call getTokenAndKey if _cloudSdkAPIBase is already set', async function () {
    setupCommand._cloudSdkAPIBase = {};
    await setupCommand.withCloudSdkBase(mockFn);
    assert.ok(!setupCommand.getTokenAndKey.called);
  });

  it('should correctly return the result of the callback function', async function () {
    mockFn.returns('callback result');
    const result = await setupCommand.withCloudSdkBase(mockFn);
    assert.strictEqual(result, 'callback result');
  });

  it('should throw the correct error when getCliOrgId returns null', async function () {
    setupCommand.getCliOrgId.returns(null);
    try {
      await setupCommand.withCloudSdkBase(mockFn);
      assert.fail('Expected error was not thrown');
    } catch (err) {
      assert(err instanceof Error);
    }
  });
});

describe('SetupCommand - getOrganizationsFromToken', function () {
  let setupCommand;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    sinon
      .stub(setupCommand, 'getTokenAndKey')
      .resolves({ accessToken: 'testAccessToken' });
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should return the correct organization map when IMS returns organizations', async function () {
    sinon.stub(setupCommand, 'getOrganizationsFromIms').resolves([
      { orgName: 'Org1', orgRef: { ident: '123', authSrc: 'AuthSrc1' } },
      { orgName: 'Org2', orgRef: { ident: '456', authSrc: 'AuthSrc2' } },
    ]);

    const expectedOrgMap = {
      Org1: '123@AuthSrc1',
      Org2: '456@AuthSrc2',
    };
    const orgMap = await setupCommand.getOrganizationsFromToken();
    assert.deepStrictEqual(orgMap, expectedOrgMap);
  });

  it('should log a message and return null when no IMS context is found', async function () {
    const logStub = sinon.stub(setupCommand, 'doLog');
    sinon.stub(setupCommand, 'getOrganizationsFromIms').rejects({
      code: 'CONTEXT_NOT_CONFIGURED',
    });
    const orgMap = await setupCommand.getOrganizationsFromToken();
    assert.strictEqual(orgMap, null);
    assert.ok(
      logStub.calledWith('No IMS context found. Please run `aio login` first.')
    );
  });

  it('should return null when IMS throws an error other than "CONTEXT_NOT_CONFIGURED"', async function () {
    sinon
      .stub(setupCommand, 'getOrganizationsFromIms')
      .rejects(new Error('Some other error'));
    const orgMap = await setupCommand.getOrganizationsFromToken();
    assert.strictEqual(orgMap, null);
  });
});

describe('SetupCommand - getOrgId', function () {
  let setupCommand;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    sinon.stub(setupCommand, 'doLog'); // Stub doLog to prevent console output during tests
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should return null when no organizations are found', async function () {
    sinon.stub(setupCommand, 'getOrganizationsFromToken').resolves(null);
    const orgId = await setupCommand.getOrgId();
    assert.strictEqual(orgId, null);
  });

  it('should return the correct organization ID when only one organization is found', async function () {
    sinon
      .stub(setupCommand, 'getOrganizationsFromToken')
      .resolves({ Org1: '123@AuthSrc1' });
    const orgId = await setupCommand.getOrgId();
    assert.strictEqual(orgId, '123@AuthSrc1');
  });

  it('should return the selected organization ID from a list of multiple organizations', async function () {
    sinon
      .stub(setupCommand, 'getOrganizationsFromToken')
      .resolves({ Org1: '123@AuthSrc1', Org2: '456@AuthSrc2' });
    sinon
      .stub(setupCommand, 'chooseOrganizationFromList')
      .resolves('456@AuthSrc2');
    const orgId = await setupCommand.getOrgId();
    assert.strictEqual(orgId, '456@AuthSrc2');
  });

  it('should return the manually input organization ID when automatic retrieval fails', async function () {
    sinon.stub(setupCommand, 'getOrganizationsFromToken').resolves({});
    sinon
      .stub(setupCommand, 'fallbackToManualOrganizationId')
      .resolves('manualOrgId');
    const orgId = await setupCommand.getOrgId();
    assert.strictEqual(orgId, 'manualOrgId');
  });
});

describe('SetupCommand - getProgramId', function () {
  let setupCommand;
  let cloudSdkAPIStub;
  let inquirerStub;
  let logStub;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    cloudSdkAPIStub = sinon.createStubInstance(CloudSdkAPIBase);
    inquirerStub = sinon.stub(inquirer, 'prompt');
    logStub = sinon.stub(setupCommand, 'doLog');
    sinon
      .stub(setupCommand, 'withCloudSdkBase')
      .callsFake((fn) => fn(cloudSdkAPIStub));
    sinon.stub(setupCommand, 'spinnerStart');
    sinon.stub(setupCommand, 'spinnerStop');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should log and return null when no programs found', async function () {
    cloudSdkAPIStub.listProgramsIdAndName.resolves([]);
    const result = await setupCommand.getProgramId();
    assert.strictEqual(result, null);
    assert.ok(
      logStub.calledWith(
        sinon.match('No programs found for the selected organization.')
      )
    );
  });

  it('should log and return the only program ID when a single program is found', async function () {
    cloudSdkAPIStub.listProgramsIdAndName.resolves([
      { id: '123', name: 'Test Program' },
    ]);
    const result = await setupCommand.getProgramId();
    assert.strictEqual(result, '123');
    assert.ok(logStub.calledWith(sinon.match('Selected only program: 123')));
  });

  it('should return the selected program ID when multiple programs are found', async function () {
    cloudSdkAPIStub.listProgramsIdAndName.resolves([
      { id: '123', name: 'Test Program 1' },
      { id: '456', name: 'Test Program 2' },
    ]);
    inquirerStub.resolves({ selectedProgram: '456' });
    const result = await setupCommand.getProgramId();
    assert.strictEqual(result, '456');
  });

  it('should use cached programs and not call the API again if programs are already cached', async function () {
    // Simulate programs are already cached
    setupCommand.programsCached = [{ id: '123', name: 'Cached Program' }];
    const result = await setupCommand.getProgramId();
    assert.strictEqual(result, '123');
    assert.ok(!cloudSdkAPIStub.listProgramsIdAndName.called);
    assert.ok(logStub.calledWith(sinon.match('Selected only program: 123')));
  });
});

describe('SetupCommand - getEnvironmentId', function () {
  let setupCommand;
  let inquirerStub;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    sinon.stub(setupCommand, 'spinnerStart');
    sinon.stub(setupCommand, 'spinnerStop');
    sinon.stub(setupCommand, 'doLog');
    inquirerStub = sinon.stub(inquirer, 'prompt');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should prompt user to choose when multiple environments are retrieved', async function () {
    sinon.stub(setupCommand, 'withCloudSdkBase').resolves([
      { id: 'env1', type: 'rde', name: 'Environment 1' },
      { id: 'env2', type: 'rde', name: 'Environment 2' },
    ]);
    inquirerStub.resolves({ selectedEnvironment: 'env1' });
    const envId = await setupCommand.getEnvironmentId('program1');
    assert.strictEqual(envId, 'env1');
  });

  it('should automatically select the environment when only one is retrieved', async function () {
    sinon
      .stub(setupCommand, 'withCloudSdkBase')
      .resolves([{ id: 'env1', type: 'rde', name: 'Environment 1' }]);
    const envId = await setupCommand.getEnvironmentId('program1');
    assert.strictEqual(envId, 'env1');
  });

  it('should return null when no environments are retrieved', async function () {
    sinon.stub(setupCommand, 'withCloudSdkBase').resolves([]);
    const envId = await setupCommand.getEnvironmentId('program1');
    assert.strictEqual(envId, null);
  });

  it('should filter out environments not of type "rde"', async function () {
    sinon.stub(setupCommand, 'withCloudSdkBase').resolves([
      { id: 'env1', type: 'rde', name: 'Environment 1' },
      { id: 'env2', type: 'not-rde', name: 'Environment 2' },
    ]);
    inquirerStub.resolves({ selectedEnvironment: 'env1' });
    const envId = await setupCommand.getEnvironmentId('program1');
    assert.strictEqual(envId, 'env1');
  });
});

describe('SetupCommand - logPreviousConfig', function () {
  let setupCommand;
  let doLogStub;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    doLogStub = sinon.stub(setupCommand, 'doLog');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should log previous organization ID if different from current', function () {
    setupCommand.logPreviousConfig(
      'prevOrg',
      null,
      null,
      null,
      null,
      'orgId',
      null,
      null
    );
    assert.ok(
      doLogStub.calledWithMatch(/Your previous organization ID was: prevOrg/)
    );
  });

  it('should not log organization ID if same as current', function () {
    setupCommand.logPreviousConfig(
      'orgId',
      null,
      null,
      null,
      null,
      'orgId',
      null,
      null
    );
    assert.ok(!doLogStub.calledWithMatch(/Your previous organization ID was:/));
  });

  it('should log previous program ID and name if different from current', function () {
    setupCommand.logPreviousConfig(
      null,
      'prevProgram',
      'prevProgramName',
      null,
      null,
      null,
      'selectedProgram',
      null
    );
    assert.ok(
      doLogStub.calledWithMatch(
        /Your previous program ID was: prevProgram \(name: prevProgramName\)/
      )
    );
  });

  it('should not log program ID and name if same as current', function () {
    setupCommand.logPreviousConfig(
      null,
      'selectedProgram',
      'selectedProgramName',
      null,
      null,
      null,
      'selectedProgram',
      null
    );
    assert.ok(!doLogStub.calledWithMatch(/Your previous program ID was:/));
  });

  it('should log previous environment ID and name if different from current', function () {
    setupCommand.logPreviousConfig(
      null,
      null,
      null,
      'prevEnv',
      'prevEnvName',
      null,
      null,
      'selectedEnvironment'
    );
    assert.ok(
      doLogStub.calledWithMatch(
        /Your previous environment ID was: prevEnv \(name: prevEnvName\)/
      )
    );
  });

  it('should not log environment ID and name if same as current', function () {
    setupCommand.logPreviousConfig(
      null,
      null,
      null,
      'selectedEnvironment',
      'selectedEnvironmentName',
      null,
      null,
      'selectedEnvironment'
    );
    assert.ok(!doLogStub.calledWithMatch(/Your previous environment ID was:/));
  });
});

describe('SetupCommand - runCommand', function () {
  let setupCommand;
  let inquirerStub;
  let configGetStub;
  let configSetStub;
  let logStub;

  beforeEach(function () {
    setupCommand = new SetupCommand();
    inquirerStub = sinon.stub(inquirer, 'prompt');
    configGetStub = sinon.stub(Config, 'get');
    configSetStub = sinon.stub(Config, 'set');
    logStub = sinon.stub(setupCommand, 'doLog');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should display error log when no configuration found and flags.show is true', async function () {
    configGetStub.returns(null);
    await setupCommand.runCommand({}, { show: true });
    assert(logStub.calledWithMatch(/No configuration found/));
  });

  it('should display current configuration when configuration exists and flags.show is true', async function () {
    configGetStub.withArgs('cloudmanager_orgid').returns('orgId');
    configGetStub.withArgs('cloudmanager_programid').returns('programId');
    configGetStub.withArgs('cloudmanager_programname').returns('programName');
    configGetStub.withArgs('cloudmanager_environmentid').returns('envId');
    configGetStub.withArgs('cloudmanager_environmentname').returns('envName');
    await setupCommand.runCommand({}, { show: true });
    assert(logStub.calledWithMatch(/Current configuration/));
  });

  it('should get organization ID and store it', async function () {
    inquirerStub.resolves({ storeLocal: true });
    sinon.stub(setupCommand, 'getOrgId').resolves('orgId');
    sinon.stub(setupCommand, 'getProgramId').resolves('programId');
    sinon.stub(setupCommand, 'getEnvironmentId').resolves('envId');
    await setupCommand.runCommand({}, {});
    assert(configSetStub.calledWith('cloudmanager_orgid', 'orgId', true));
  });

  it('should exit early if no program ID is selected', async function () {
    sinon.stub(setupCommand, 'getProgramId').resolves(null);
    inquirerStub.resolves({ storeLocal: 'y' });
    await setupCommand.runCommand({}, {});
    assert.ok(!logStub.calledWithMatch(/No program or environment found/));
  });

  it('should handle errors correctly', async function () {
    sinon.stub(setupCommand, 'getOrgId').rejects(new Error('Test error'));
    await assert.rejects(async () => await setupCommand.runCommand({}, {}));
  });
});

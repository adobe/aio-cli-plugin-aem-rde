const assert = require('assert');
const sinon = require('sinon').createSandbox();
const StatusCommand = require('../../../../src/commands/aem/rde/status.js');
const { cli } = require('../../../../src/lib/base-command.js');
const Config = require('@adobe/aio-lib-core-config');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../../util');

const stubbedMethods = {
  getArtifacts: () =>
    Object.create({
      status: 200,
      json: () =>
        Object.create({
          status: 'Ready',
          items: [
            {
              id: 'test-bundle',
              updateId: '1',
              service: 'author',
              type: 'osgi-bundle',
              metadata: {
                name: 'test.all-1.0.0-SNAPSHOT.zip',
                bundleSymbolicName: 'test-bundle',
                bundleName: 'Test Bundle',
                bundleVersion: '1.0.0',
              },
            },
          ],
        }),
    }),
};

let command, cloudSdkApiStub;
describe('StatusCommand', function () {
  setupLogCapturing(sinon, cli);

  before(() => {
    sinon.useFakeTimers();
  });

  beforeEach(() => {
    sinon
      .stub(Config, 'get')
      .withArgs('cloudmanager_programid')
      .returns('12345')
      .withArgs('cloudmanager_environmentid')
      .returns('54321');
  });

  afterEach(() => {
    Config.get.restore();
  });

  describe('#run as textual result', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new StatusCommand([], null),
        stubbedMethods
      );
    });

    it('should call getArtifacts() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getArtifacts.calledOnce, true);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        'Running StatusCommand on cm-p12345-e54321\n' +
          'Info for cm-p12345-e54321\n' +
          'Environment: Ready\n' +
          '- Bundles Author:\n' +
          ' test-bundle-1.0.0\n' +
          '- Bundles Publish:\n' +
          '- Configurations Author:\n' +
          '- Configurations Publish:'
      );
    });
  });

  describe('#run as json result', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new StatusCommand(['--json', '--quiet'], null),
        stubbedMethods
      );
    });

    it('should call getArtifacts() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getArtifacts.calledOnce, true);
    });

    it('should have the expected json result', async function () {
      await command.run();
      assert.deepEqual(
        {
          status: 'Ready',
          environmentId: '54321',
          programId: '12345',
          author: {
            osgiBundles: [
              {
                id: 'test-bundle',
                updateId: '1',
                service: 'author',
                type: 'osgi-bundle',
                metadata: {
                  name: 'test.all-1.0.0-SNAPSHOT.zip',
                  bundleSymbolicName: 'test-bundle',
                  bundleName: 'Test Bundle',
                  bundleVersion: '1.0.0',
                },
              },
            ],
            osgiConfigs: [],
          },
          publish: {
            osgiBundles: [
              {
                id: 'test-bundle',
                updateId: '1',
                service: 'author',
                type: 'osgi-bundle',
                metadata: {
                  name: 'test.all-1.0.0-SNAPSHOT.zip',
                  bundleSymbolicName: 'test-bundle',
                  bundleName: 'Test Bundle',
                  bundleVersion: '1.0.0',
                },
              },
            ],
            osgiConfigs: [],
          },
        },
        JSON.parse(cli.log.getCapturedLogOutput())
      );
    });
  });
});

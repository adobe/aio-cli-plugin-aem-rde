const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiConfigurationsCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-configurations');
const { cli } = require('../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../util.js');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethods = {
  getOsgiConfigurations: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  getOsgiConfigurations: () => errorObj,
  getOsgiConfiguration: () => errorObj,
};

const stubbedMethods = {
  getOsgiConfiguration: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              pid: 'com.adobe.aem.test',
              properties: {
                addressbookProdHost: 'https://test.com',
              },
            }
          ),
      }
    ),
  getOsgiConfigurations: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              status: '200',
              items: [
                {
                  pid: 'com.adobe.aem.test',
                  properties: {
                    addressbookProdHost: 'https://test.com',
                    addressBookStageHost: 'https://test.com',
                    ethosEnvClusterType:
                      '$[env:ETHOS_ENV_CLUSTER_TYPE;default= ]',
                    imsOrganization: '$[env:imsOrganization;default= ]',
                  },
                },
                {
                  pid: 'com.adobe.aem.collaborationapi.test',
                  properties: {
                    assetsPipelineTopic: '$[env:test;default= ]',
                  },
                },
                {
                  pid: 'com.adobe.aem.core.test',
                  properties: { 'test.enabled': true },
                },
              ],
            }
          ),
      }
    ),
};

describe('OsgiConfigurationsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run as textual results', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand([], null),
      stubbedMethods
    );

    it('should call getOsgiConfigurations() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfigurations.calledOnce, true);
    });

    it('should produce the correct textual output for getOsgiConfigurations.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m PID                                 \x1B[22m\n' +
          '\x1B[1m ─────────────────────────────────── \x1B[22m\n' +
          ' com.adobe.aem.test                  \n' +
          ' com.adobe.aem.collaborationapi.test \n' +
          ' com.adobe.aem.core.test             '
      );
    });
  });

  describe('#run as json result for getOsgiConfigurations.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand(['-o', 'json'], null),
      stubbedMethods
    );

    it('should call getOsgiConfigurations() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfigurations.calledOnce, true);
    });

    it('should have the expected json array result', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"pid":"com.adobe.aem.test","properties":{"addressbookProdHost":"https://test.com","addressBookStageHost":"https://test.com","ethosEnvClusterType":"$[env:ETHOS_ENV_CLUSTER_TYPE;default= ]","imsOrganization":"$[env:imsOrganization;default= ]"}},{"pid":"com.adobe.aem.collaborationapi.test","properties":{"assetsPipelineTopic":"$[env:test;default= ]"}},{"pid":"com.adobe.aem.core.test","properties":{"test.enabled":true}}]'
      );
    });
  });

  describe('#run specific (id) osgi-configuration as textual result', function () {
    const reqId = 'com.adobe.aem.test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand([reqId], null),
      stubbedMethods
    );

    it('should call getOsgiConfiguration() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfiguration.calledOnce, true);
    });

    it('should call the getOsgiConfiguration() with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfiguration.args[0][1], reqId);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m PID                \x1B[22m\n' +
          '\x1B[1m ────────────────── \x1B[22m\n' +
          ' com.adobe.aem.test '
      );
    });
  });
  describe('#run specific (id) osgi-configuration as json result', function () {
    const [command] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand(['0', '-o', 'json'], null),
      stubbedMethods
    );
    it('should produce the correct json output for a osgi-configuration', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "pid": "com.adobe.aem.test",\n' +
          '  "properties": {\n' +
          '    "addressbookProdHost": "https://test.com"\n' +
          '  }\n' +
          '}'
      );
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200 (all osgi-configurations).', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });
    it('Should print out a error message when status is not 200. (one osgi-configuration [id])', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['1'], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand([], null),
        stubbedThrowErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

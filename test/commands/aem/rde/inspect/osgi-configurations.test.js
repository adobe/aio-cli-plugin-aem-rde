const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiConfigurationsCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-configurations');
const { cli } = require('../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../util.js');
const chalk = require('chalk');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethod = () => {
  throw new Error(errorObj.statusText);
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

  describe('#getOsgiConfigurations', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand([], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfigurations.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(' PID                                 '),
          chalk.bold(' ─────────────────────────────────── '),
          ' com.adobe.aem.test                  ',
          ' com.adobe.aem.collaborationapi.test ',
          ' com.adobe.aem.core.test             ',
        ].join('\n')
      );
    });

    it('Should have the expected json array result', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['-o', 'json'], null),
        stubbedMethods
      );

      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"pid":"com.adobe.aem.test","properties":{"addressbookProdHost":"https://test.com","addressBookStageHost":"https://test.com","ethosEnvClusterType":"$[env:ETHOS_ENV_CLUSTER_TYPE;default= ]","imsOrganization":"$[env:imsOrganization;default= ]"}},{"pid":"com.adobe.aem.collaborationapi.test","properties":{"assetsPipelineTopic":"$[env:test;default= ]"}},{"pid":"com.adobe.aem.core.test","properties":{"test.enabled":true}}]'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand([], null),
        { ...stubbedMethods, getOsgiConfigurations: () => errorObj }
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
        {
          ...stubbedMethods,
          getOsgiConfigurations: stubbedThrowErrorMethod,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });

  describe('#getOsgiConfiguration', function () {
    const reqId = 'com.adobe.aem.test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiConfigurationsCommand([reqId], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfiguration.calledOnce, true);
    });

    it('Should be called with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfiguration.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(' PID                '),
          chalk.bold(' ────────────────── '),
          ' com.adobe.aem.test ',
        ].join('\n')
      );
    });

    it('Should produce the correct json output', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['0', '-o', 'json'], null),
        stubbedMethods
      );
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

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['1'], null),

        { ...stubbedMethods, getOsgiConfiguration: () => errorObj }
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
        new OsgiConfigurationsCommand([reqId], null),
        {
          ...stubbedMethods,
          getOsgiConfiguration: stubbedThrowErrorMethod,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiConfigurationsCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-configurations');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../util.js');
const chalk = require('chalk');

const errorObj = Object.assign(
  {},
  {
    status: 403,
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

let command, cloudSdkApiStub;
describe('OsgiConfigurationsCommand', function () {
  describe('#getOsgiConfigurations', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet'], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiConfigurations.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        command.log.getCapturedLogOutput(),
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
        new OsgiConfigurationsCommand(['--quiet', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, [
        {
          pid: 'com.adobe.aem.test',
          properties: {
            addressbookProdHost: 'https://test.com',
            addressBookStageHost: 'https://test.com',
            ethosEnvClusterType: '$[env:ETHOS_ENV_CLUSTER_TYPE;default= ]',
            imsOrganization: '$[env:imsOrganization;default= ]',
          },
        },
        {
          pid: 'com.adobe.aem.collaborationapi.test',
          properties: { assetsPipelineTopic: '$[env:test;default= ]' },
        },
        {
          pid: 'com.adobe.aem.core.test',
          properties: { 'test.enabled': true },
        },
      ]);
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet'], null),
        { ...stubbedMethods, getOsgiConfigurations: () => errorObj }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorObj.status} with message ${errorObj.statusText}. Please, try again later and if the error persists, report it.`
        );
      }
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet'], null),
        {
          ...stubbedMethods,
          getOsgiConfigurations: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_OSGI_CONFIGURATIONS_ERROR] There was an unexpected error when running get osgi configurations command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });

  describe('#getOsgiConfiguration', function () {
    const reqId = 'com.adobe.aem.test';
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet', reqId], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

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
        command.log.getCapturedLogOutput(),
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
        new OsgiConfigurationsCommand(['--quiet', '0', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, {
        pid: 'com.adobe.aem.test',
        properties: {
          addressbookProdHost: 'https://test.com',
        },
      });
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet', '1'], null),

        { ...stubbedMethods, getOsgiConfiguration: () => errorObj }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorObj.status} with message ${errorObj.statusText}. Please, try again later and if the error persists, report it.`
        );
      }
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiConfigurationsCommand(['--quiet', reqId], null),
        {
          ...stubbedMethods,
          getOsgiConfiguration: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_OSGI_CONFIGURATIONS_ERROR] There was an unexpected error when running get osgi configurations command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });
});

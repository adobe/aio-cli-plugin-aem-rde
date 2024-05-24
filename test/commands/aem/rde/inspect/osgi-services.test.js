const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiServicesCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-services');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../util.js');
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
  getOsgiService: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              id: 0,
              types: ['com.adobe.cq.dam.bla.bli.blu'],
              scope: 'bundle',
              bundleId: 0,
              properties: {
                'component.id': 0,
                'component.name': 'com.adobe.cq.dam.blabliblu',
                'osgi.ds.satisfying.condition.target':
                  '(osgi.condition.id=true)',
                'service.ranking': 0,
              },
              usingBundles: [0],
            }
          ),
      }
    ),
  getOsgiServices: () =>
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
                  id: 0,
                  types: ['com.adobe.cq.dam.bla.bli.blu'],
                  scope: 'bundle',
                  bundleId: 0,
                  properties: {
                    'component.id': 0,
                    'component.name': 'com.adobe.cq.dam.blabliblu',
                    'osgi.ds.satisfying.condition.target':
                      '(osgi.condition.id=true)',
                    'service.ranking': 0,
                  },
                  usingBundles: [0],
                },
                {
                  id: 1,
                  types: ['com.adobe.cq.dam.bla.bli.blu'],
                  scope: 'bundle',
                  bundleId: 1,
                  properties: {
                    'component.id': 1,
                    'component.name': 'com.adobe.cq.dam.blabliblu',
                    'osgi.ds.satisfying.condition.target':
                      '(osgi.condition.id=true)',
                    'service.ranking': 1,
                  },
                  usingBundles: [1],
                },
                {
                  id: 2,
                  types: ['com.adobe.cq.dam.bla.bli.blu'],
                  scope: 'bundle',
                  bundleId: 2,
                  properties: {
                    'component.id': 2,
                    'component.name': 'com.adobe.cq.dam.blabliblu',
                    'osgi.ds.satisfying.condition.target':
                      '(osgi.condition.id=true)',
                    'service.ranking': 2,
                  },
                  usingBundles: [2],
                },
              ],
            }
          ),
      }
    ),
};

let command, cloudSdkApiStub;
describe('OsgiServicesCommand', function () {
  describe('#getOsgiServices', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet'], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiServices.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        command.log.getCapturedLogOutput(),
        [
          chalk.bold(
            ' ID Scope  Bundle ID Types                              '
          ),
          chalk.bold(
            ' ── ────── ───────── ────────────────────────────────── '
          ),
          " 0  bundle 0         [ 'com.adobe.cq.dam.bla.bli.blu' ] ",
          " 1  bundle 1         [ 'com.adobe.cq.dam.bla.bli.blu' ] ",
          " 2  bundle 2         [ 'com.adobe.cq.dam.bla.bli.blu' ] ",
        ].join('\n')
      );
    });

    it('Should have the expected json array result', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, [
        {
          id: 0,
          types: ['com.adobe.cq.dam.bla.bli.blu'],
          scope: 'bundle',
          bundleId: 0,
          properties: {
            'component.id': 0,
            'component.name': 'com.adobe.cq.dam.blabliblu',
            'osgi.ds.satisfying.condition.target': '(osgi.condition.id=true)',
            'service.ranking': 0,
          },
          usingBundles: [0],
        },
        {
          id: 1,
          types: ['com.adobe.cq.dam.bla.bli.blu'],
          scope: 'bundle',
          bundleId: 1,
          properties: {
            'component.id': 1,
            'component.name': 'com.adobe.cq.dam.blabliblu',
            'osgi.ds.satisfying.condition.target': '(osgi.condition.id=true)',
            'service.ranking': 1,
          },
          usingBundles: [1],
        },
        {
          id: 2,
          types: ['com.adobe.cq.dam.bla.bli.blu'],
          scope: 'bundle',
          bundleId: 2,
          properties: {
            'component.id': 2,
            'component.name': 'com.adobe.cq.dam.blabliblu',
            'osgi.ds.satisfying.condition.target': '(osgi.condition.id=true)',
            'service.ranking': 2,
          },
          usingBundles: [2],
        },
      ]);
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet'], null),
        {
          ...stubbedMethods,
          getOsgiServices: () => errorObj,
        }
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
        new OsgiServicesCommand(['--quiet'], null),

        {
          ...stubbedMethods,
          getOsgiServices: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_OSGI_SERVICES_ERROR] There was an unexpected error when running get osgi services command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });

  describe('#getOsgiService', function () {
    const reqId = '0';
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet', reqId], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiService.calledOnce, true);
    });

    it('Should be called with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiService.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        command.log.getCapturedLogOutput(),
        [
          chalk.bold(
            ' ID Scope  Bundle ID Types                              '
          ),
          chalk.bold(
            ' ── ────── ───────── ────────────────────────────────── '
          ),
          " 0  bundle 0         [ 'com.adobe.cq.dam.bla.bli.blu' ] ",
        ].join('\n')
      );
    });

    it('Should produce the correct json output for a osgi service', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet', '0', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, {
        id: 0,
        types: ['com.adobe.cq.dam.bla.bli.blu'],
        scope: 'bundle',
        bundleId: 0,
        properties: {
          'component.id': 0,
          'component.name': 'com.adobe.cq.dam.blabliblu',
          'osgi.ds.satisfying.condition.target': '(osgi.condition.id=true)',
          'service.ranking': 0,
        },
        usingBundles: [0],
      });
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['--quiet', '1'], null),
        {
          ...stubbedMethods,
          getOsgiService: () => errorObj,
        }
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
        new OsgiServicesCommand(['--quiet', '1'], null),

        {
          ...stubbedMethods,
          getOsgiService: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_OSGI_SERVICES_ERROR] There was an unexpected error when running get osgi services command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });
});

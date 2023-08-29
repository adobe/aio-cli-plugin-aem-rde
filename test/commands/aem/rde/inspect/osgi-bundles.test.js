const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiBundlesCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-bundles');
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

const stubbedThrowErrorMethods = () => {
  throw new Error(errorObj.statusText);
};

const stubbedMethods = {
  getOsgiBundle: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              id: 1,
              name: 'test',
              symbolicName: 'test',
              version: '0.0.1',
              state: 1,
              stateString: 'active',
              startLevel: 1,
              exportedPackages: [],
              importedPackages: [
                { name: 'org.osgi.test', version: '1', bundleId: 1 },
                { name: 'org.test', version: '1', bundleId: 2 },
              ],
              fragmentsAttached: [],
              registeredServices: [9, 8, 3],
              servicesInUse: [6, 5, 9, 1, 8, 36],
            }
          ),
      }
    ),

  getOsgiBundles: () =>
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
                  name: 'System Bundle',
                  symbolicName: 'org.apache.test',
                  version: '7.0.1',
                  state: 3,
                  stateString: 'active',
                  startLevel: 0,
                  manifestHeaders: {
                    'Bundle-ManifestVersion': '2',
                    'Export-Package': [],
                  },
                },
                {
                  id: 1,
                  name: 'test',
                  symbolicName: 'test',
                  version: '0.0.1',
                  state: 1,
                  stateString: 'active',
                  startLevel: 1,
                  exportedPackages: [],
                  importedPackages: [
                    { name: 'org.osgi.test', version: '1', bundleId: 1 },
                    { name: 'org.test', version: '1', bundleId: 2 },
                  ],
                  fragmentsAttached: [],
                  registeredServices: [9, 8, 3],
                  servicesInUse: [6, 5, 9, 1, 8, 36],
                },
              ],
            }
          ),
      }
    ),
};

describe('OsgiBundlesCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#getOsgiBundles', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand([], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundles.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(
            ' ID                  Name          Version State  State String Start Level '
          ),
          chalk.bold(
            ' ─────────────────── ───────────── ─────── ────── ──────────── ─────────── '
          ),
          ' 0                   System Bundle 7.0.1   3      active       0           ',
          ' 1                   test          0.0.1   1      active       1           ',
        ].join('\n')
      );
    });

    it('Should have the expected json array result', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand(['-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"id":0,"name":"System Bundle","symbolicName":"org.apache.test","version":"7.0.1","state":3,"stateString":"active","startLevel":0,"manifestHeaders":{"Bundle-ManifestVersion":"2","Export-Package":[]}},{"id":1,"name":"test","symbolicName":"test","version":"0.0.1","state":1,"stateString":"active","startLevel":1,"exportedPackages":[],"importedPackages":[{"name":"org.osgi.test","version":"1","bundleId":1},{"name":"org.test","version":"1","bundleId":2}],"fragmentsAttached":[],"registeredServices":[9,8,3],"servicesInUse":[6,5,9,1,8,36]}]'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand([], null),
        { ...stubbedMethods, getOsgiBundles: () => errorObj }
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
        new OsgiBundlesCommand([], null),
        {
          ...stubbedMethods,
          getOsgiBundles: stubbedThrowErrorMethods,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });

  describe('#getOsgiBundle', function () {
    const reqId = 'com.adobe.aem.test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand([reqId], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundle.calledOnce, true);
    });

    it('Should be called with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundle.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(
            ' ID                  Name   Version State  State String Start Level '
          ),
          chalk.bold(
            ' ─────────────────── ────── ─────── ────── ──────────── ─────────── '
          ),
          ' 1                   test   0.0.1   1      active       1           ',
        ].join('\n')
      );
    });

    it('Should produce the correct json output', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand(['0', '-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "id": 1,\n' +
          '  "name": "test",\n' +
          '  "symbolicName": "test",\n' +
          '  "version": "0.0.1",\n' +
          '  "state": 1,\n' +
          '  "stateString": "active",\n' +
          '  "startLevel": 1,\n' +
          '  "exportedPackages": [],\n' +
          '  "importedPackages": [\n' +
          '    {\n' +
          '      "name": "org.osgi.test",\n' +
          '      "version": "1",\n' +
          '      "bundleId": 1\n' +
          '    },\n' +
          '    {\n' +
          '      "name": "org.test",\n' +
          '      "version": "1",\n' +
          '      "bundleId": 2\n' +
          '    }\n' +
          '  ],\n' +
          '  "fragmentsAttached": [],\n' +
          '  "registeredServices": [\n' +
          '    9,\n' +
          '    8,\n' +
          '    3\n' +
          '  ],\n' +
          '  "servicesInUse": [\n' +
          '    6,\n' +
          '    5,\n' +
          '    9,\n' +
          '    1,\n' +
          '    8,\n' +
          '    36\n' +
          '  ]\n' +
          '}'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand([reqId], null),
        { ...stubbedMethods, getOsgiBundle: () => errorObj }
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
        new OsgiBundlesCommand([reqId], null),
        {
          ...stubbedMethods,
          getOsgiBundle: stubbedThrowErrorMethods,
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

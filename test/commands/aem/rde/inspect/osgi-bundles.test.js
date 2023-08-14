const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiBundlesCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-bundles');
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
  getOsgiBundles: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  getOsgiBundles: () => errorObj,
  getOsgiBundle: () => errorObj,
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

  describe('#run as textual results', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand([], null),
      stubbedMethods
    );

    it('should call getOsgiBundles() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundles.calledOnce, true);
    });

    it('should produce the correct textual output for getOsgiBundles.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m ID                  Name          Version State  State String Start Level \x1B[22m\n' +
          '\x1B[1m ─────────────────── ───────────── ─────── ────── ──────────── ─────────── \x1B[22m\n' +
          ' 0                   System Bundle 7.0.1   3      active       0           \n' +
          ' 1                   test          0.0.1   1      active       1           '
      );
    });
  });

  describe('#run as json result for getOsgiBundles.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand(['-o', 'json'], null),
      stubbedMethods
    );

    it('should call getOsgiBundles() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundles.calledOnce, true);
    });

    it('should have the expected json array result', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"id":0,"name":"System Bundle","symbolicName":"org.apache.test","version":"7.0.1","state":3,"stateString":"active","startLevel":0,"manifestHeaders":{"Bundle-ManifestVersion":"2","Export-Package":[]}},{"id":1,"name":"test","symbolicName":"test","version":"0.0.1","state":1,"stateString":"active","startLevel":1,"exportedPackages":[],"importedPackages":[{"name":"org.osgi.test","version":"1","bundleId":1},{"name":"org.test","version":"1","bundleId":2}],"fragmentsAttached":[],"registeredServices":[9,8,3],"servicesInUse":[6,5,9,1,8,36]}]'
      );
    });
  });

  describe('#run specific (id) osgi-bundle as textual result', function () {
    const reqId = 'com.adobe.aem.test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand([reqId], null),
      stubbedMethods
    );

    it('should call getOsgiBundle() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundle.calledOnce, true);
    });

    it('should call the getOsgiBundle() with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiBundle.args[0][1], reqId);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m ID                  Name   Version State  State String Start Level \x1B[22m\n' +
          '\x1B[1m ─────────────────── ────── ─────── ────── ──────────── ─────────── \x1B[22m\n' +
          ' 1                   test   0.0.1   1      active       1           '
      );
    });
  });
  describe('#run specific (id) osgi-bundle as json result', function () {
    const [command] = createCloudSdkAPIStub(
      sinon,
      new OsgiBundlesCommand(['0', '-o', 'json'], null),
      stubbedMethods
    );
    it('should produce the correct json output for a osgi-bundle', async function () {
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
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200 (all osgi-bundles).', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });
    it('Should print out a error message when status is not 200. (one osgi-bundle [id])', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiBundlesCommand(['1'], null),
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
        new OsgiBundlesCommand([], null),
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

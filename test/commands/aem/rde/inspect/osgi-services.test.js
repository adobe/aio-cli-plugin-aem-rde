const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiServicesCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-services');
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
  getOsgiServices: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  getOsgiServices: () => errorObj,
  getOsgiService: () => errorObj,
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

describe('OsgiServicesCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run as textual results', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiServicesCommand([], null),
      stubbedMethods
    );

    it('should call getOsgiServices() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiServices.calledOnce, true);
    });

    it('should produce the correct textual output for getOsgiServices.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m ID Scope  Bundle ID Types                              \x1B[22m\n' +
          '\x1B[1m ── ────── ───────── ────────────────────────────────── \x1B[22m\n' +
          " 0  bundle 0         [ 'com.adobe.cq.dam.bla.bli.blu' ] \n" +
          " 1  bundle 1         [ 'com.adobe.cq.dam.bla.bli.blu' ] \n" +
          " 2  bundle 2         [ 'com.adobe.cq.dam.bla.bli.blu' ] "
      );
    });
  });

  describe('#run as json result for getOsgiServices.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiServicesCommand(['-o', 'json'], null),
      stubbedMethods
    );

    it('should call getOsgiServices() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiServices.calledOnce, true);
    });

    it('should have the expected json array result', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"id":0,"types":["com.adobe.cq.dam.bla.bli.blu"],"scope":"bundle","bundleId":0,"properties":{"component.id":0,"component.name":"com.adobe.cq.dam.blabliblu","osgi.ds.satisfying.condition.target":"(osgi.condition.id=true)","service.ranking":0},"usingBundles":[0]},{"id":1,"types":["com.adobe.cq.dam.bla.bli.blu"],"scope":"bundle","bundleId":1,"properties":{"component.id":1,"component.name":"com.adobe.cq.dam.blabliblu","osgi.ds.satisfying.condition.target":"(osgi.condition.id=true)","service.ranking":1},"usingBundles":[1]},{"id":2,"types":["com.adobe.cq.dam.bla.bli.blu"],"scope":"bundle","bundleId":2,"properties":{"component.id":2,"component.name":"com.adobe.cq.dam.blabliblu","osgi.ds.satisfying.condition.target":"(osgi.condition.id=true)","service.ranking":2},"usingBundles":[2]}]'
      );
    });
  });

  describe('#run specific (id) osgi-service as textual result', function () {
    const reqId = '0';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiServicesCommand([reqId], null),
      stubbedMethods
    );

    it('should call getOsgiService() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiService.calledOnce, true);
    });

    it('should call the getOsgiService() with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiService.args[0][1], reqId);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m ID Scope  Bundle ID Types                              \x1B[22m\n' +
          '\x1B[1m ── ────── ───────── ────────────────────────────────── \x1B[22m\n' +
          " 0  bundle 0         [ 'com.adobe.cq.dam.bla.bli.blu' ] "
      );
    });
  });
  describe('#run specific (id) osgi-service as json result', function () {
    const [command] = createCloudSdkAPIStub(
      sinon,
      new OsgiServicesCommand(['0', '-o', 'json'], null),
      stubbedMethods
    );
    it('should produce the correct json output for a osgi service', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "id": 0,\n' +
          '  "types": [\n' +
          '    "com.adobe.cq.dam.bla.bli.blu"\n' +
          '  ],\n' +
          '  "scope": "bundle",\n' +
          '  "bundleId": 0,\n' +
          '  "properties": {\n' +
          '    "component.id": 0,\n' +
          '    "component.name": "com.adobe.cq.dam.blabliblu",\n' +
          '    "osgi.ds.satisfying.condition.target": "(osgi.condition.id=true)",\n' +
          '    "service.ranking": 0\n' +
          '  },\n' +
          '  "usingBundles": [\n' +
          '    0\n' +
          '  ]\n' +
          '}'
      );
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200 (all osgi-services).', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });
    it('Should print out a error message when status is not 200. (one osgi-service [id])', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiServicesCommand(['1'], null),
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
        new OsgiServicesCommand([], null),
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

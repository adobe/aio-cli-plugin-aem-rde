const assert = require('assert');
const sinon = require('sinon').createSandbox();
const OsgiComponentsCommand = require('../../../../../src/commands/aem/rde/inspect/osgi-components');
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
  getOsgiComponents: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  getOsgiComponents: () => errorObj,
  getOsgiComponent: () => errorObj,
};

const stubbedMethods = {
  getOsgiComponent: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              enabled: true,
              name: 'com.adobe.test',
              bundleId: 1,
              scope: 'singleton',
              implementationClass: 'com.adobe.granite.workflow.test',
              defaultEnabled: true,
              immediate: false,
            }
          ),
      }
    ),

  getOsgiComponents: () =>
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
                  enabled: true,
                  name: 'com.day.cq.wcm.core.test',
                  bundleId: 1,
                  scope: 'singleton',
                  implementationClass: 'com.day.cq.wcm.core.test',
                  defaultEnabled: true,
                  immediate: false,
                  serviceInterfaces: ['com.day.cq.wcm.core.test'],
                  properties: {
                    getBatchSize: 100,
                    'osgi.ds.test': '(osgi.condition.id=true)',
                    isAutoReplicationEnabled: false,
                    getJobWindow: 1,
                  },
                  references: [
                    {
                      name: 'osgi.ds.test',
                      interfaceName: 'org.osgi.service.test',
                      cardinality: '1..1.1',
                      policy: 'dynamic',
                      policyOption: 'reluctant',
                      target: '(osgi.condition.id=true)',
                      scope: 'bundle',
                    },
                  ],
                  activate: 'activate',
                  deactivate: 'deactivate',
                  configurationPolicy: 'optional',
                  configurationPids: ['com.day.cq.wcm.core.test'],
                  factoryProperties: {},
                  activationFields: [],
                  init: 0,
                  configurations: [],
                },
                {
                  enabled: true,
                  name: 'org.apache.sling.test',
                  bundleId: 2,
                  scope: 'singleton',
                  implementationClass: 'org.apache.sling.test',
                  defaultEnabled: true,
                  immediate: false,
                  serviceInterfaces: ['org.apache.sling.commons.test'],
                  properties: { 'osgi.ds.test': '(osgi.condition.id=true)' },
                  references: [
                    {
                      name: 'classLoaderWriter',
                      interfaceName: 'org.apache.sling.test',
                      cardinality: '1..1',
                      policy: 'static',
                      policyOption: 'reluctant',
                      field: 'classLoaderWriter',
                      fieldOption: 'replace',
                      scope: 'bundle',
                    },
                    {
                      name: 'osgi.ds.satisfying.test',
                      interfaceName: 'org.osgi.service.test',
                      cardinality: '1..1',
                      policy: 'dynamic',
                      policyOption: 'reluctant',
                      target: '(osgi.test.id=true)',
                      scope: 'bundle',
                    },
                  ],
                  activate: 'activate',
                  deactivate: 'deactivate',
                  configurationPolicy: 'optional',
                  configurationPids: ['org.apache.sling.test'],
                  factoryProperties: {},
                  activationFields: [],
                  init: 0,
                  configurations: [],
                },
              ],
            }
          ),
      }
    ),
};

describe('OsgiComponentsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run as textual results', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiComponentsCommand([], null),
      stubbedMethods
    );

    it('should call getOsgiComponents() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiComponents.calledOnce, true);
    });

    it('should produce the correct textual output for getOsgiComponents.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m NAME                     Bundle ID Scope     Immediate Implementation Class     \x1B[22m\n' +
          '\x1B[1m ──────────────────────── ───────── ───────── ───────── ──────────────────────── \x1B[22m\n' +
          ' com.day.cq.wcm.core.test 1         singleton false     com.day.cq.wcm.core.test \n' +
          ' org.apache.sling.test    2         singleton false     org.apache.sling.test    '
      );
    });
  });

  describe('#run as json result for getOsgiComponents.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiComponentsCommand(['-o', 'json'], null),
      stubbedMethods
    );

    it('should call getOsgiComponents() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiComponents.calledOnce, true);
    });

    it('should have the expected json array result', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[{"enabled":true,"name":"com.day.cq.wcm.core.test","bundleId":1,"scope":"singleton","implementationClass":"com.day.cq.wcm.core.test","defaultEnabled":true,"immediate":false,"serviceInterfaces":["com.day.cq.wcm.core.test"],"properties":{"getBatchSize":100,"osgi.ds.test":"(osgi.condition.id=true)","isAutoReplicationEnabled":false,"getJobWindow":1},"references":[{"name":"osgi.ds.test","interfaceName":"org.osgi.service.test","cardinality":"1..1.1","policy":"dynamic","policyOption":"reluctant","target":"(osgi.condition.id=true)","scope":"bundle"}],"activate":"activate","deactivate":"deactivate","configurationPolicy":"optional","configurationPids":["com.day.cq.wcm.core.test"],"factoryProperties":{},"activationFields":[],"init":0,"configurations":[]},{"enabled":true,"name":"org.apache.sling.test","bundleId":2,"scope":"singleton","implementationClass":"org.apache.sling.test","defaultEnabled":true,"immediate":false,"serviceInterfaces":["org.apache.sling.commons.test"],"properties":{"osgi.ds.test":"(osgi.condition.id=true)"},"references":[{"name":"classLoaderWriter","interfaceName":"org.apache.sling.test","cardinality":"1..1","policy":"static","policyOption":"reluctant","field":"classLoaderWriter","fieldOption":"replace","scope":"bundle"},{"name":"osgi.ds.satisfying.test","interfaceName":"org.osgi.service.test","cardinality":"1..1","policy":"dynamic","policyOption":"reluctant","target":"(osgi.test.id=true)","scope":"bundle"}],"activate":"activate","deactivate":"deactivate","configurationPolicy":"optional","configurationPids":["org.apache.sling.test"],"factoryProperties":{},"activationFields":[],"init":0,"configurations":[]}]'
      );
    });
  });

  describe('#run specific (id) osgi-component as textual result', function () {
    const reqId = 'com.adobe.aem.test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new OsgiComponentsCommand([reqId], null),
      stubbedMethods
    );

    it('should call getOsgiComponent() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiComponent.calledOnce, true);
    });

    it('should call the getOsgiComponent() with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getOsgiComponent.args[0][1], reqId);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m NAME                     Bundle ID Scope     Immediate Implementation Class            \x1B[22m\n' +
          '\x1B[1m ──────────────────────── ───────── ───────── ───────── ─────────────────────────────── \x1B[22m\n' +
          ' com.adobe.test           1         singleton false     com.adobe.granite.workflow.test '
      );
    });
  });
  describe('#run specific (id) osgi-component as json result', function () {
    const [command] = createCloudSdkAPIStub(
      sinon,
      new OsgiComponentsCommand(['0', '-o', 'json'], null),
      stubbedMethods
    );
    it('should produce the correct json output for a osgi-component', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "enabled": true,\n' +
          '  "name": "com.adobe.test",\n' +
          '  "bundleId": 1,\n' +
          '  "scope": "singleton",\n' +
          '  "implementationClass": "com.adobe.granite.workflow.test",\n' +
          '  "defaultEnabled": true,\n' +
          '  "immediate": false\n' +
          '}'
      );
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200 (all osgi-components).', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiComponentsCommand([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });
    it('Should print out a error message when status is not 200. (one osgi-component [id])', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new OsgiComponentsCommand(['1'], null),
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
        new OsgiComponentsCommand([], null),
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

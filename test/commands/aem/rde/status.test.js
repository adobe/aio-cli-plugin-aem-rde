const assert = require('assert');
const sinon = require('sinon');
const StatusCommand = require('../../../../src/commands/aem/rde/status.js');
const { cli } = require('../../../../src/lib/base-command');

const mockCloudSDKAPI = {};
mockCloudSDKAPI.called = [];
mockCloudSDKAPI.getArtifacts = function (cursor) {
  this.called.push('getArtifacts');

  const result = {};
  result.status = 200;
  result.json = function () {
    const jsres = {};
    jsres.status = 'Ready';
    jsres.items = [
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
    ];
    return jsres;
  };
  return result;
};

const mockWithCloudSdk = function (fn) {
  return fn(mockCloudSDKAPI);
};

describe('StatusCommand', function () {
  describe('#run as textual result', async function () {
    const sc = new StatusCommand();
    sc.withCloudSdk = mockWithCloudSdk.bind(sc);
    sc.argv = [];

    sc.run();
    it('getArtifacts() has been called once', function () {
      assert.equal(1, mockCloudSDKAPI.called.length);
      assert.equal('getArtifacts', mockCloudSDKAPI.called[0]);
    });
  });

  describe('#run as json result', async function () {
    let mockCliLines = '';

    let logStub;
    before(function () {
      logStub = sinon.stub(cli, 'log');
      logStub.callsFake(function (v) {
        mockCliLines += v + '\n';
      });
    });
    after(function () {
      logStub.restore();
    });

    it('should have the expected json result', async function () {
      const sc = new StatusCommand();
      sc.withCloudSdk = mockWithCloudSdk.bind(sc);
      sc.argv = ['--json'];

      await sc.run();
      assert.deepEqual(
        {
          status: 'Ready',
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
        JSON.parse(mockCliLines)
      );
    });
  });

  // TODO run with actual results
});

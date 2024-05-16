const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RestartCommand = require('../../../../src/commands/aem/rde/restart.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../../util');
const { cli } = require('../../../../src/lib/base-command');

let command, cloudSdkApiStub;
describe('RestartCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new RestartCommand(['--quiet'], null),
        {
          restartEnv: () => {},
        }
      );
    });

    it('cloudSDKAPI.restartEnv() has been called', async function () {
      await command.run();
      assert.ok(cloudSdkApiStub.restartEnv.calledOnce);
    });
  });
});

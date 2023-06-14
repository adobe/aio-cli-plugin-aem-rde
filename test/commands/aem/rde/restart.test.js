const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RestartCommand = require('../../../../src/commands/aem/rde/restart.js');
const {createCloudSdkAPIStub, setupLogCapturing} = require("./util");
const {cli} = require("../../../../src/lib/base-command");

describe('RestartCommand', function() {

  setupLogCapturing(sinon, cli);

  describe('#run', function() {
    let [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, new RestartCommand([], null), {
      restartEnv: () => {}
    });
    it('cloudSDKAPI.restartEnv() has been called', async function() {
      await command.run();
      assert.ok(cloudSdkApiStub.restartEnv.calledOnce);
    });
  });
});

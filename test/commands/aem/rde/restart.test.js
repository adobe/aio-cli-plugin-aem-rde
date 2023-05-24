const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RestartCommand = require('../../../../src/commands/aem/rde/restart.js');
const {createCloudSdkAPIStub, setupLogCapturing} = require("./util");
const {cli} = require("../../../../src/lib/base-command");

describe('RestartCommand', () => {

  setupLogCapturing(sinon, cli);

  describe('#run', () => {
    let [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, new RestartCommand([], null), {
      restartEnv: () => {}
    });
    it('cloudSDKAPI.restartEnv() has been called', async () => {
      await command.run();
      assert.ok(cloudSdkApiStub.restartEnv.calledOnce);
    });
  });
});

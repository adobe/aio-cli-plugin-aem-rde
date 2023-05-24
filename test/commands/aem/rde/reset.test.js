const assert = require('assert');
const sinon = require('sinon').createSandbox();
const ResetCommand = require('../../../../src/commands/aem/rde/reset.js');
const {createCloudSdkAPIStub, setupLogCapturing} = require("./util");
const {cli} = require("../../../../src/lib/base-command");

describe('ResetCommand', () => {

  setupLogCapturing(sinon, cli);

  describe('#run', () => {
    it('cloudSDKAPI.resetEnv() has been called', async () => {
      let [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, new ResetCommand([], null), {
        resetEnv: () => {}
      })
      await command.run();
      assert.ok(cloudSdkApiStub.resetEnv.calledOnce);
    });
  });
});

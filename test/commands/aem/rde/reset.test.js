const assert = require('assert');
const sinon = require('sinon').createSandbox();
const ResetCommand = require('../../../../src/commands/aem/rde/reset.js');
const { createCloudSdkAPIStub, setupLogCapturing } = require('./util');
const { cli } = require('../../../../src/lib/base-command');

describe('ResetCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run', function () {
    it('cloudSDKAPI.resetEnv() has been called', async function () {
      let [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new ResetCommand([], null),
        {
          resetEnv: () => {},
        }
      );
      await command.run();
      assert.ok(cloudSdkApiStub.resetEnv.calledOnce);
    });
  });
});

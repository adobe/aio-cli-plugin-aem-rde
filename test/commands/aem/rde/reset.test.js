const assert = require('assert');
const sinon = require('sinon').createSandbox();
const ResetCommand = require('../../../../src/commands/aem/rde/reset.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../../util');
const { cli } = require('../../../../src/lib/base-command');

describe('ResetCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run', function () {
    it('cloudSDKAPI.resetEnv() has been called', async function () {
      const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
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

  describe('#run quiet', function () {
    it('cloudSDKAPI.resetEnv() has been called', async function () {
      const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new ResetCommand(['--quiet'], null),
        {
          resetEnv: () => {},
        }
      );
      await command.run();
      assert.ok(cloudSdkApiStub.resetEnv.calledOnce);
    });
  });
});

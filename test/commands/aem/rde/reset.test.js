const assert = require('assert');
const sinon = require('sinon').createSandbox();
const ResetCommand = require('../../../../src/commands/aem/rde/reset.js');
const { createCloudSdkAPIStub } = require('../../../util');

describe('ResetCommand', function () {
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

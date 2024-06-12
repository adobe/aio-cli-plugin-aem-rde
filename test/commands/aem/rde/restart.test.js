const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RestartCommand = require('../../../../src/commands/aem/rde/restart.js');
const { createCloudSdkAPIStub } = require('../../../util');

let command, cloudSdkApiStub;
describe('RestartCommand', function () {
  describe('#run', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new RestartCommand([], null),
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

  describe('#run quiet', function () {
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

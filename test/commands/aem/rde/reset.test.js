const assert = require('assert');
const sinon = require('sinon').createSandbox();
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../../util');
const { cli } = require('../../../../src/lib/base-command');
const ResetCommand = require('../../../../src/commands/aem/rde/reset.js');

const spinnerStartStub = sinon.stub();
const spinnerStopStub = sinon.stub();

describe('ResetCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#run', function () {
    let command;
    let cloudSdkApiStub;
    beforeEach(function () {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new ResetCommand([], null),
        {
          resetEnv: () => {},
        }
      );
      Object.assign(command, {
        spinnerStart: spinnerStartStub,
        spinnerStop: spinnerStopStub,
      });
    });
    afterEach(function () {
      spinnerStartStub.reset();
      spinnerStopStub.reset();
    });
    it('cloudSDKAPI.resetEnv() has been called', async function () {
      await command.run();
      assert.ok(cloudSdkApiStub.resetEnv.calledOnce);
      assert.ok(spinnerStartStub.calledOnce);
    });
    it('stop the spinner and throw error', async function () {
      let err;
      try {
        spinnerStartStub.throws(new Error('Failed to start a spinner'));
        await command.run();
      } catch (e) {
        err = e;
      }
      assert.ok(spinnerStopStub.calledOnce);
      assert.equal(err.code, 'INTERNAL_RESET_ERROR');
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

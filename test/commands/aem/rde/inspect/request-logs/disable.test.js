const assert = require('assert');
const sinon = require('sinon').createSandbox();
const DisableRequestLogsCommand = require('../../../../../../src/commands/aem/rde/inspect/request-logs/disable');
const { cli } = require('../../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../util.js');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethods = {
  disableRequestLogs: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  disableRequestLogs: () => errorObj,
};

const stubbedMethods = {
  disableRequestLogs: () =>
    Object.assign(
      {},
      {
        status: 200,
        enabled: false,
        names: [],
        paths: [],
        items: [],
      }
    ),
};

describe('DisableRequestLogsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('# Disable request logs.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new DisableRequestLogsCommand([], null),
      stubbedMethods
    );

    it('should call disableRequestLogs() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.disableRequestLogs.calledOnce, true);
    });

    it('should return a message to the console if the disable action was successful', async function () {
      await command.run();
      assert.equal(cli.log.getCapturedLogOutput(), 'Request-logs disabled.');
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new DisableRequestLogsCommand([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new DisableRequestLogsCommand([], null),
        stubbedThrowErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

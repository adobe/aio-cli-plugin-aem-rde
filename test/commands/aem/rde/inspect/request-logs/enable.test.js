const assert = require('assert');
const sinon = require('sinon').createSandbox();
const EnableRequestLogsCommand = require('../../../../../../src/commands/aem/rde/inspect/request-logs/enable');
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
  enableRequestLogs: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  enableRequestLogs: () => errorObj,
};

const stubbedMethods = {
  enableRequestLogs: () =>
    Object.assign(
      {},
      {
        status: 201,
        statusText: 'Created',
      }
    ),
};

describe('EnableRequestLogsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#check if arguments get passed right', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new EnableRequestLogsCommand([], null),
      stubbedMethods
    );

    it('should call enableRequestLogs() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.enableRequestLogs.calledOnce, true);
    });

    it('should produce the correct textual output for enableRequestLogs.', async function () {
      await command.run();
      assert.equal(cli.log.getCapturedLogOutput(), 'Request-logs enabled.');
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new EnableRequestLogsCommand([], null),
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
        new EnableRequestLogsCommand([], null),
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

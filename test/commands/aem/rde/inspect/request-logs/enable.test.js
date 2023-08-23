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

  describe('#enableRequestLogs', function () {
    const arg = 'test';
    const format =
      '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n';
    const includePathPatterns = '*test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new EnableRequestLogsCommand(
        [
          '-i',
          arg,
          '-d',
          arg,
          '-f',
          format,
          '-e',
          arg,
          '-p',
          includePathPatterns,
          '-i',
          arg,
          '-w',
          arg,
          '-p',
          includePathPatterns,
        ],
        null
      ),
      stubbedMethods
    );

    it('Should pass the includePathPatterns in the right format', async function () {
      await command.run();
      assert.deepStrictEqual(
        cloudSdkApiStub.enableRequestLogs.args[0][1].includePathPatterns,
        ['*test', '*test']
      );
    });

    it('Should pass the format-args in the right format', async function () {
      await command.run();
      assert.equal(
        cloudSdkApiStub.enableRequestLogs.args[0][1].format,
        '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'
      );
    });

    it('Should pass the level/logger args in the right format', async function () {
      await command.run();
      assert.deepStrictEqual(
        cloudSdkApiStub.enableRequestLogs.args[0][1].names,
        [
          { level: 'INFO', logger: arg },
          { level: 'INFO', logger: arg },
          { level: 'DEBUG', logger: arg },
          { level: 'WARN', logger: arg },
          { level: 'ERROR', logger: arg },
        ]
      );
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.enableRequestLogs.calledOnce, true);
    });

    it('Should produce the correct textual output.', async function () {
      await command.run();
      assert.equal(cli.log.getCapturedLogOutput(), 'Request-logs enabled.');
    });

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

const assert = require('assert');
const sinon = require('sinon').createSandbox();
const chalk = require('chalk');
const LogsCommand = require('../../../../src/commands/aem/rde/logs.js');
const inquirer = require('inquirer');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../util.js');

const errorResponse404 = {
  status: 404,
  statusText: 'Test error message.',
};

const errorResponse403 = {
  status: 403,
  statusText: 'Test error message 403.',
};

const errorObj = new Error(errorResponse404.statusText);

const createLogsSuccessObj = {
  status: 201,
  json: async () =>
    Object.assign(
      {},
      {
        id: '6',
        names: [{ logger: '', level: 'INFO' }],
        format: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
      }
    ),
};
const aemLogTailSuccessObj = {
  status: 200,
  text: async () =>
    '11.08.2023 07:55:24.278 *INFO* [898-59] log.request 11/Aug/2023:07:55:24 +0000 [919] TEST',
};
const aemLogsSuccessObj = {
  status: 200,
  json: async () =>
    Object.assign(
      {},
      {
        status: 'Ready',
        items: [
          {
            id: '5',
            names: [{ logger: '', level: 'INFO' }],
            format:
              '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
          },
        ],
      }
    ),
};
const status200 = {
  status: 200,
};

const stubbedMethods = {
  createAemLog: createLogsSuccessObj,
  getAemLogs: aemLogsSuccessObj,
  getAemLogTail: aemLogTailSuccessObj,
  deleteAemLog: status200,
};

let command, cloudSdkApiStub;

describe('LogsCommand', function () {
  before(() => sinon.useFakeTimers());
  after(() => sinon.restore());

  beforeEach(() => {
    [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new LogsCommand(['--quiet', '-d com.adobe', '--no-color'], null),
      stubbedMethods
    );
    setupLogCapturing(sinon, command);
  });

  afterEach(async () => {
    try {
      await command.stopAndCleanup();
    } catch (e) {
      console.info('Error in afterEach handler', e);
    }
  });

  describe('#getAemLogs', function () {
    it('Should throw an internal error.', async function () {
      cloudSdkApiStub.createAemLog.returns(errorResponse404);
      cloudSdkApiStub.getAemLogs.throws(errorObj);
      try {
        await command.run();
        await sinon.clock.runToLastAsync();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code 404 with message Test error message.. Please, try again later and if the error persists, report it.`,
            `Error message ${e.message} is not the expected one`
          )
        );
      }
    });
    it('Should throw an error message when status is not 200', async function () {
      cloudSdkApiStub.createAemLog.returns(errorResponse404);
      cloudSdkApiStub.getAemLogs.returns(errorResponse404);
      try {
        await command.run();
        await sinon.clock.runToLastAsync();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorResponse404.status} with message ${errorResponse404.statusText}. Please, try again later and if the error persists, report it.`
        );
      }
    });
  });

  describe('#getAemLogTail', function () {
    it('Should be called 2 times', async function () {
      await command.run();
      await sinon.clock.runToLastAsync();
      await sinon.clock.runToLastAsync();
      sinon.assert.callCount(cloudSdkApiStub.getAemLogTail, 2);
    });

    it('Should print out the log tail', async function () {
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(
        command.log.getCapturedLogOutput(),
        '11.08.2023 07:55:24.278 *INFO* [898-59] log.request 11/Aug/2023:07:55:24 +0000 [919] TEST'
      );
    });

    it('Should print out the logs in color', async function () {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand(['--quiet', '-d com.adobe'], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);

      cloudSdkApiStub.getAemLogTail.onCall(0).returns({
        status: 200,
        text: async () =>
          '11.08.2023 07:55:24.278 *TRACE* [898-55] TEST\n' +
          '11.08.2023 07:55:24.278 *DEBUG* [898-56] TEST\n' +
          '11.08.2023 07:55:24.278 *INFO* [898-57] TEST\n' +
          '11.08.2023 07:55:24.278 *WARN* [898-58] TEST\n' +
          '11.08.2023 07:55:24.278 *ERROR* [898-59] TEST\n',
      });
      cloudSdkApiStub.getAemLogTail.onCall(1).returns({
        status: 200,
        text: async () => '',
      });

      await command.run();
      await sinon.clock.runToLastAsync();
      await sinon.clock.runToLastAsync();
      assert.equal(
        command.log.getCapturedLogOutput(),
        [
          chalk.blackBright('11.08.2023 07:55:24.278 *TRACE* [898-55] TEST'),
          chalk.cyan('11.08.2023 07:55:24.278 *DEBUG* [898-56] TEST'),
          chalk.green('11.08.2023 07:55:24.278 *INFO* [898-57] TEST'),
          chalk.yellow('11.08.2023 07:55:24.278 *WARN* [898-58] TEST'),
          chalk.red('11.08.2023 07:55:24.278 *ERROR* [898-59] TEST'),
        ].join('\n')
      );
    });
  });

  describe('#deleteAemLog', function () {
    it('Should be called exactly once', async function () {
      await command.run();
      await command.stopAndCleanup(); // called on SIGINT and SIGTERM
      assert.equal(cloudSdkApiStub.deleteAemLog.callCount, 1);
    });

    it('Should catch the throw and print out a error message.', async function () {
      cloudSdkApiStub.deleteAemLog.throws(errorObj);
      try {
        await command.run();
        await command.stopAndCleanup();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_DELETE_LOG_ERROR] There was an unexpected error when running delete log command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });

    it('Should print out a error message when status is not 200', async function () {
      cloudSdkApiStub.deleteAemLog.returns(errorResponse403);
      try {
        await command.run();
        await command.stopAndCleanup();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_DELETE_LOG_ERROR] There was an unexpected error when running delete log command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });

  describe('#createAemLog', function () {
    const arg = 'test';
    const format =
      '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n';

    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand(
          [
            '--quiet',
            '-i',
            arg,
            '-d',
            arg,
            '-f',
            format,
            '-e',
            arg,
            '-i',
            arg,
            '-w',
            arg,
          ],
          null
        ),
        stubbedMethods
      );
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.ok(cloudSdkApiStub.createAemLog.calledOnce);
    });

    it('Should formats the format-args right', async function () {
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(
        cloudSdkApiStub.createAemLog.args[0][1].format,
        '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'
      );
    });

    it('Should formats the level/logger args right', async function () {
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.deepStrictEqual(cloudSdkApiStub.createAemLog.args[0][1].names, [
        { level: 'DEBUG', logger: arg },
        { level: 'INFO', logger: arg },
        { level: 'INFO', logger: arg },
        { level: 'WARN', logger: arg },
        { level: 'ERROR', logger: arg },
      ]);
    });

    it('Should print out an error message when status is not 201', async function () {
      cloudSdkApiStub.createAemLog.returns(errorResponse404);
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          '[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code 404 with message Test error message.. Please, try again later and if the error persists, report it.'
        );
      }
    });

    it('Should throw an error.', async function () {
      cloudSdkApiStub.createAemLog.throws(errorObj);
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.match(
          e.message,
          /^\[RDECLI:INTERNAL_CREATE_LOG_ERROR] There was an unexpected error when running create log command\. .*/
        );
      }
    });
  });

  describe('#chooseLogConfiguration', function () {
    let originalExit;
    beforeEach(() => {
      originalExit = process.exit;
      process.exit = sinon.stub();
      sinon.stub(inquirer, 'prompt');
    });

    afterEach(() => {
      process.exit = originalExit;
      inquirer.prompt.restore();
    });

    it('Should successfully return the selected log configuration', async function () {
      cloudSdkApiStub.getAemLogs.returns({
        status: 200,
        json: async () => ({
          items: [
            { id: '1', names: [{ logger: 'com.adobe', level: 'INFO' }] },
            { id: '2', names: [{ logger: 'com.adobe', level: 'DEBUG' }] },
          ],
        }),
      });
      inquirer.prompt.resolves({ logId: '1' });

      const result = await command.chooseLogConfiguration({}, false);
      assert.deepEqual(result, {
        id: '1',
        names: [{ logger: 'com.adobe', level: 'INFO' }],
      });
    });

    it('Should return null when no log configurations are available', async function () {
      cloudSdkApiStub.getAemLogs.returns({
        status: 200,
        json: async () => ({ items: null }),
      });

      const result = await command.chooseLogConfiguration({}, false);
      assert.equal(null, result);
    });

    it('Should exit the process when user cancels selection', async function () {
      cloudSdkApiStub.getAemLogs.returns({
        status: 200,
        json: async () => ({
          items: [{ id: '1', names: [{ logger: 'com.adobe', level: 'INFO' }] }],
        }),
      });
      inquirer.prompt.resolves({ logId: 'cancel' });

      await command.chooseLogConfiguration({}, false);
      sinon.assert.calledOnce(process.exit);
    });

    it('Should throw UNEXPECTED_API_ERROR for unexpected status code', async function () {
      cloudSdkApiStub.getAemLogs.returns({
        status: 500,
        statusText: 'Internal Server Error',
      });

      try {
        await command.chooseLogConfiguration({}, false);
        assert.fail('Expected method to throw.');
      } catch (err) {
        // fine
      }
    });
  });
});

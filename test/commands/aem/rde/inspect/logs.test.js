const assert = require('assert');
const sinon = require('sinon').createSandbox();
const chalk = require('chalk');
const LogsCommand = require('../../../../../src/commands/aem/rde/logs');
const { cli } = require('../../../../../src/lib/base-command.js');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../util.js');

const errorResponse = {
  status: 404,
  statusText: 'Test error message.',
};

const errorObj = new Error(errorResponse.statusText);

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

const tooManyLogsSuccessObj = {
  status: 200,
  json: () =>
    Object.create({
      status: 'Ready',
      items: ['0', '1', '2'].map((id) =>
        Object.create({
          id,
          names: [{ logger: '', level: 'INFO' }],
          format:
            '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
        })
      ),
    }),
};

const stubbedMethods = {
  createAemLog: createLogsSuccessObj,
  getAemLogs: aemLogsSuccessObj,
  getAemLogTail: aemLogTailSuccessObj,
  deleteAemLog: status200,
};

let command, cloudSdkApiStub;

describe('LogsCommand', function () {
  setupLogCapturing(sinon, cli);

  before(() => sinon.useFakeTimers());
  after(() => sinon.restore());

  beforeEach(() => {
    [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new LogsCommand(['-d com.adobe', '--no-color'], null),
      stubbedMethods
    );
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
      cloudSdkApiStub.createAemLog.returns(errorResponse);
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
      cloudSdkApiStub.createAemLog.returns(errorResponse);
      cloudSdkApiStub.getAemLogs.returns(errorResponse);
      try {
        await command.run();
        await sinon.clock.runToLastAsync();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorResponse.status} with message ${errorResponse.statusText}. Please, try again later and if the error persists, report it.`
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
        cli.log.getCapturedLogOutput(),
        '11.08.2023 07:55:24.278 *INFO* [898-59] log.request 11/Aug/2023:07:55:24 +0000 [919] TEST'
      );
    });

    it('Should print out the logs in color', async function () {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand(['-d com.adobe'], null),
        stubbedMethods
      );

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
        cli.log.getCapturedLogOutput(),
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
      cloudSdkApiStub.deleteAemLog.returns(errorResponse);
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

    it('Should be called once for cleanup when there are more than 2 logs saved', async function () {
      cloudSdkApiStub.createAemLog.onCall(0).returns(errorResponse);
      cloudSdkApiStub.createAemLog.onCall(1).returns(createLogsSuccessObj);
      cloudSdkApiStub.getAemLogs.returns(tooManyLogsSuccessObj);
      await command.run();
      assert.equal(cloudSdkApiStub.deleteAemLog.callCount, 1);
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
          ['-i', arg, '-d', arg, '-f', format, '-e', arg, '-i', arg, '-w', arg],
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
      cloudSdkApiStub.createAemLog.returns(errorResponse);
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
});

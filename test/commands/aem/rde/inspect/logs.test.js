const assert = require('assert');
const sinon = require('sinon').createSandbox();
const LogsCommand = require('../../../../../src/commands/aem/rde/inspect/logs');
const { cli } = require('../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../util.js');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethods = () => {
  throw new Error(errorObj.statusText);
};

const stubbedMethods = {
  getAemLogs: async () =>
    Object.assign(
      {},
      {
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
      }
    ),
  getAemLogTail: async () =>
    Object.assign(
      {},
      {
        status: 200,
        text: async () =>
          '11.08.2023 07:55:24.278 *INFO* [898-59] log.request 11/Aug/2023:07:55:24 +0000 [919] TEST',
      }
    ),
  deleteAemLog: async () =>
    Object.assign(
      {},
      {
        status: 200,
      }
    ),
  createAemLog: async () =>
    Object.assign(
      {},
      {
        status: 201,
        json: async () =>
          Object.assign(
            {},
            {
              id: '6',
              names: [{ logger: '', level: 'INFO' }],
              format:
                '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
            }
          ),
      }
    ),
};

const getToManyAemLogs = async () =>
  Object.assign(
    {},
    {
      status: 200,
      json: () =>
        Object.assign(
          {},
          {
            status: 'Ready',
            items: [
              {
                id: '0',
                names: [{ logger: '', level: 'INFO' }],
                format:
                  '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
              },
              {
                id: '1',
                names: [{ logger: '', level: 'INFO' }],
                format:
                  '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
              },
              {
                id: '2',
                names: [{ logger: '', level: 'INFO' }],
                format:
                  '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
              },
            ],
          }
        ),
    }
  );

let command, cloudSdkApiStub;

describe('LogsCommand', function () {
  setupLogCapturing(sinon, cli);

  before(() => sinon.useFakeTimers());
  after(() => sinon.restore());

  beforeEach(() => {
    [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new LogsCommand([], null),
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
    it('Should be called exactly once', async function () {
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(cloudSdkApiStub.getAemLogs.calledOnce, true);
    });

    it('Should catch the throw and print out a error message.', async function () {
      [command] = createCloudSdkAPIStub(sinon, new LogsCommand([], null), {
        ...stubbedMethods,
        getAemLogs: stubbedThrowErrorMethods,
      });
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
    it('Should print out an error message when status is not 200', async function () {
      [command] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand([], null),
        // overwriting the stubbed method with one that is returning 404
        { ...stubbedMethods, getAemLogs: () => errorObj }
      );
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
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

    it('Should print out an error message when status is not 200', async function () {
      [command] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand([], null),
        // overwriting the stubbed method with one that is returning 404
        { ...stubbedMethods, getAemLogTail: () => errorObj }
      );
      await command.run();
      await sinon.clock.runToLastAsync();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
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
      [command] = createCloudSdkAPIStub(sinon, new LogsCommand([], null), {
        ...stubbedMethods,
        deleteAemLog: () => {
          throw new Error(errorObj.statusText);
        },
      });

      await command.run();
      await command.stopAndCleanup();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      [command] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand([], null),
        // overwriting the stubbed method with one that is returning 404
        { ...stubbedMethods, deleteAemLog: () => errorObj }
      );
      await command.run();
      await command.stopAndCleanup();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });

    it('Should be called once for cleanup when there are more than 2 logs saved', async function () {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand([], null),
        // overwrites the stbbed method with one that returns more than 2 logs
        { ...stubbedMethods, getAemLogs: getToManyAemLogs }
      );

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
        { level: 'INFO', logger: arg },
        { level: 'INFO', logger: arg },
        { level: 'DEBUG', logger: arg },
        { level: 'WARN', logger: arg },
        { level: 'ERROR', logger: arg },
      ]);
    });

    it('Should print out an error message when status is not 201', async function () {
      [command] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand([], null),
        // overwriting the stubbed method with one that is returning 404
        { ...stubbedMethods, createAemLog: () => errorObj }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });

    it('Should catch the throw and print out a error message.', async function () {
      [command] = createCloudSdkAPIStub(sinon, new LogsCommand([], null), {
        ...stubbedMethods,
        createAemLog: stubbedThrowErrorMethods,
      });
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

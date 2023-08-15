/* eslint-disable jest/expect-expect */
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

describe('LogsCommand', function () {
  setupLogCapturing(sinon, cli);

  before(() => sinon.useFakeTimers());
  after(() => sinon.restore());
  // afterEach(() => {
  //   // make sure the command exits after each test
  //   process.emit('SIGINT');
  // });

  describe('#run', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new LogsCommand([], null),
      stubbedMethods
    );

    describe('#getAemLogs', function () {
      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(cloudSdkApiStub.getAemLogs.calledOnce, true);
        process.emit('SIGINT');
      });

      it('Should catch the throw and print out a error message.', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          { ...stubbedMethods, getAemLogs: stubbedThrowErrorMethods }
        );
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.statusText}`
        );
      });
      it('Should print out an error message when status is not 200', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that is returning 404
          { ...stubbedMethods, getAemLogs: () => errorObj }
        );
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.status} - ${errorObj.statusText}`
        );
      });
    });

    describe('#getAemLogTail', function () {
      it('should be called 2 times', async function () {
        await command.run();
        await sinon.clock.runToLast();
        await sinon.clock.runToLast();
        process.emit('SIGINT');
        sinon.assert.callCount(cloudSdkApiStub.getAemLogTail, 2);
      });

      it('should print out the log tail', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          '11.08.2023 07:55:24.278 *INFO* [898-59] log.request 11/Aug/2023:07:55:24 +0000 [919] TEST'
        );
        process.emit('SIGINT');
      });

      it('Should print out an error message when status is not 200', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that is returning 404
          { ...stubbedMethods, getAemLogTail: async () => errorObj }
        );
        sinon.clock.reset();
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.status} - ${errorObj.statusText}`
        );
        process.emit('SIGINT');
      });
    });

    describe('#deleteAemLog', function () {
      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        process.emit('SIGINT');
        assert.equal(cloudSdkApiStub.deleteAemLog.calledOnce, true);
      });

      it('Should catch the throw and print out a error message.', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that throws an error
          {
            ...stubbedMethods,
            deleteAemLog: stubbedThrowErrorMethods,
          }
        );

        await command.run();
        await sinon.clock.runToLast();

        process.emit('SIGINT');
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.statusText}`
        );
      });

      it('Should print out a error message when status is not 200', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that is returning 404
          { ...stubbedMethods, deleteAemLog: () => errorObj }
        );
        await command.run();
        await sinon.clock.runToLast();
        process.emit('SIGINT');
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.status} - ${errorObj.statusText}`
        );
      });

      it('should be called 2 times when there are more than 2 logs saved', async function () {
        const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwrites the stbbed method with one that returns more than 2 logs
          { ...stubbedMethods, getAemLogs: getToManyAemLogs }
        );

        await command.run();
        await sinon.clock.runToLast();
        process.emit('SIGINT');
        assert.equal(cloudSdkApiStub.deleteAemLog.callCount, 2);
      });
    });
    describe('#createAemLog', function () {
      const arg = 'test';
      const format =
        '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n';
      const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new LogsCommand(
          ['-i', arg, '-d', arg, '-f', format, '-e', arg, '-i', arg, '-w', arg],
          null
        ),
        stubbedMethods
      );

      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.ok(cloudSdkApiStub.createAemLog.calledOnce);
        process.emit('SIGINT');
      });

      it('should formats the format-args right', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cloudSdkApiStub.createAemLog.args[0][1].format,
          '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'
        );
        process.emit('SIGINT');
      });

      it('should formats the level/logger args right', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.deepStrictEqual(cloudSdkApiStub.createAemLog.args[0][1].names, [
          { level: 'INFO', logger: arg },
          { level: 'INFO', logger: arg },
          { level: 'DEBUG', logger: arg },
          { level: 'WARN', logger: arg },
          { level: 'ERROR', logger: arg },
        ]);
        process.emit('SIGINT');
      });

      it('Should print out an error message when status is not 201', async function () {
        const [command] = createCloudSdkAPIStub(
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
        process.emit('SIGINT');
      });

      it('Should catch the throw and print out a error message.', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that throws an error
          {
            ...stubbedMethods,
            createAemLog: stubbedThrowErrorMethods,
          }
        );
        await command.run();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.statusText}`
        );
        process.emit('SIGINT');
      });
    });
  });
});

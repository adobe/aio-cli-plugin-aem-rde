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
          Object.create({
            status: 'Ready',
            items: [
              {
                id: '54b981e4-ff38-4dc9-8b05-4c8907b68457',
                names: [{ logger: '', level: 'INFO' }],
                format:
                  '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
              },
            ],
          }),
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
        // json: () =>
        //   Object.create({
        //     status: 'Ready',
        //     items: [
        //       {
        //         id: '54b981e4-ff38-4dc9-8b05-4c8907b68457',
        //         names: [{ logger: '', level: 'INFO' }],
        //         format:
        //           '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
        //       },
        //     ],
        //   }),
      }
    ),
  createAemLog: async () =>
    Object.assign(
      {},
      {
        status: 201,
        json: async () =>
            Object.assign({}, {
            id: '54b981e4-ff38-4dc9-8b05-4c8907b68457',
            names: [{ logger: '', level: 'INFO' }],
            format: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n',
          }),
      }
    )
};

const stubbedMethodsToManyAemLogs = {
  getAemLogs: async () =>
    Object.assign(
      {},
      {
        status: 200,
        json: async () =>
          Object.create({
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
          }),
      }
    ),
};

/**
 * how to write test, to check if smth is called x time in y minutes? the interval thing
 * check that on ctl c the interval is stoped -> how to test that (2x ctl c)
 */
describe('LogsCommand', function () {
  // TODO: How to solve the MaxListenersExceededWarning error?
  // TODO: need to test for SIGTERM as well
  setupLogCapturing(sinon, cli);

  before(() => sinon.useFakeTimers());
  after(() => sinon.restore())
  afterEach(() => {
    // make sure the command exits after each test
    process.emit('SIGINT');
  });

  describe('#run', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new LogsCommand([], null),
      stubbedMethods
    );
    /**
  //  * if status 200 call getAemlogs once
  //  * if status !200 getaemlogs print error message
  //  * catch a genatall throw
     */
    describe('#getAemLogs', function () {
      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(cloudSdkApiStub.getAemLogs.calledOnce, true);
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

    /**
  //  * if status 200 call create Logs -> call getAEMlogstail once
     * if status 200 call create Logs -> call getAEMlogstail -> 200 -> print output
  //  * if status 200 call create Logs -> call getAEMlogstail -> !200 -> print error
     */
    describe('#getAemLogTail', function () {
      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        await sinon.clock.runToLast();
        sinon.assert.callCount(cloudSdkApiStub.getAemLogTail, 2);

        process.emit('SIGINT');
        sinon.assert.calledOnce(cloudSdkApiStub.deleteAemLog);
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
      });
    });

    /**
  //  * if status 200 call create Logs -> call create AEM logs once
  //  * if status 200 call create Logs -> call create AEM logs -> with right formated body (format, warn, debug, info etc)
     * if status 200 call create Logs -> call create AEM logs -> 201 -> output log
  //  * if status 200 call create Logs -> call create AEM logs -> !201 -> output error message
  //  * if status 200 call create Logs -> call create AEM logs -> throw smth -> output error message
     */
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
      });

      it('should formats the format-args right', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cloudSdkApiStub.createAemLog.args[0][1].format,
          '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'
        );
      });

      it('should formats the level/logger args right', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.deepEqual(cloudSdkApiStub.createAemLog.args[0][1].names, [
          { level: 'INFO', logger: arg },
          { level: 'INFO', logger: arg },
          { level: 'DEBUG', logger: arg },
          { level: 'WARN', logger: arg },
          { level: 'ERROR', logger: arg },
        ]);
      });

      it('Should print out an error message when status is not 201', async function () {
        const [command] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwriting the stubbed method with one that is returning 404
          { ...stubbedMethods, createAemLog: () => errorObj }
        );
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.status} - ${errorObj.statusText}`
        );
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
        await sinon.clock.runToLast();
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.statusText}`
        );
      });
    });

    /**
  //  * if status 200 & >=3 eintrage rufe 2x deleteAEMLogs auf
  //  * if status 200 & <=2 eintrage rufe 1x deleteAEMLogs auf
  //  * if status 200 & >=3 eintrage rufe deleteAEMLogs auf -> !200 -> error message
  //  * if status 200 & >=3 eintrage rufe deleteAEMLogs auf -> throw -> error message
     * check that on ctl c the deleteLog function gets caled
     */
    describe('#deleteAemLog', function () {
      it('should be called exactly once', async function () {
        await command.run();
        await sinon.clock.runToLast();
        assert.equal(cloudSdkApiStub.deleteAemLog.calledOnce, true);
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
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.status} - ${errorObj.statusText}`
        );
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
        assert.equal(
          cli.log.getCapturedLogOutput(),
          `Error: ${errorObj.statusText}`
        );
      });
      it('should be called 2 times when there are more than 2 logs saved', async function () {
        const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
          sinon,
          new LogsCommand([], null),
          // overwrites the stbbed method with one that returns more than 2 logs
          { ...stubbedMethods, ...stubbedMethodsToManyAemLogs.getAemLogs }
        );

        await command.run();
        sinon.clock.tick(2 * 1500);
        assert.equal(cloudSdkApiStub.deleteAemLog.callCount, 2);
      });
    });
  });
});

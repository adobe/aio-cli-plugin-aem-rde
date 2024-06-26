const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RequestLogsCommand = require('../../../../../../src/commands/aem/rde/inspect/request-logs');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../../util.js');
const chalk = require('chalk');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethod = () => {
  throw new Error(errorObj.statusText);
};

const stubbedMethods = {
  getRequestLog: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              id: '0',
              method: 'HEAD',
              path: '/libs/test.html',
              log: ['log bla bli blu'],
              'sling-request-log': [
                '      0 TIMER_START{Request Processing}',
                '      0 COMMENT timer_end format is {<elapsed microseconds>,<timer name>} <optional message>',
                '      3 LOG Method=HEAD, PathInfo=null',
              ],
            }
          ),
      }
    ),

  getRequestLogs: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              status: '200',
              enabled: true,
              names: [{ logger: '', level: 'INFO' }],
              format: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* %logger %msg%n',
              includePathPatterns: [],
              items: [
                { id: '0', method: 'GET', path: '/metrics' },
                {
                  id: '1',
                  method: 'HEAD',
                  path: '/libs/login.html',
                },
                { id: '2', method: 'GET', path: '/metrics' },
                {
                  id: '3',
                  method: 'HEAD',
                  path: '/libs/login.html',
                },
              ],
            }
          ),
      }
    ),
};

let command, cloudSdkApiStub;
describe('RequestLogsCommand', function () {
  describe('#getRequestLogs', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet'], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getRequestLogs.calledOnce, true);
    });

    it('Should produce the correct textual output.', async function () {
      await command.run();
      assert.equal(
        command.log.getCapturedLogOutput(),
        [
          chalk.bold(' ID                  Method Path             '),
          chalk.bold(' ─────────────────── ────── ──────────────── '),
          ' 0                   GET    /metrics         ',
          ' 1                   HEAD   /libs/login.html ',
          ' 2                   GET    /metrics         ',
          ' 3                   HEAD   /libs/login.html ',
        ].join('\n')
      );
    });

    it('Should have the expected json array result.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, [
        { id: '0', method: 'GET', path: '/metrics' },
        { id: '1', method: 'HEAD', path: '/libs/login.html' },
        { id: '2', method: 'GET', path: '/metrics' },
        { id: '3', method: 'HEAD', path: '/libs/login.html' },
      ]);
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet'], null),
        { ...stubbedMethods, getRequestLogs: () => errorObj }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorObj.status} with message ${errorObj.statusText}. Please, try again later and if the error persists, report it.`
        );
      }
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet'], null),
        {
          ...stubbedMethods,
          getRequestLogs: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_REQUEST_LOGS_ERROR] There was an unexpected error when running request logs command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });

  describe('#getRequestLog', function () {
    const reqId = '0';
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet', reqId], null),
        stubbedMethods
      );
      setupLogCapturing(sinon, command);
    });

    it('Should be called exactly once.', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getRequestLog.calledOnce, true);
    });

    it('Should be called with an id argument.', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getRequestLog.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        command.log.getCapturedLogOutput(),
        [
          chalk.bold(' ID                  Method Path            '),
          chalk.bold(' ─────────────────── ────── ─────────────── '),
          ' 0                   HEAD   /libs/test.html ',
        ].join('\n')
      );
    });

    it('Should produce the correct json output.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet', '0', '--json'], null),
        stubbedMethods
      );
      const json = await command.run();
      assert.deepEqual(json.items, {
        id: '0',
        method: 'HEAD',
        path: '/libs/test.html',
        log: ['log bla bli blu'],
        'sling-request-log': [
          '      0 TIMER_START{Request Processing}',
          '      0 COMMENT timer_end format is {<elapsed microseconds>,<timer name>} <optional message>',
          '      3 LOG Method=HEAD, PathInfo=null',
        ],
      });
    });

    it('Should print out a error message when status is not 200.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet', '1'], null),
        { ...stubbedMethods, getRequestLog: () => errorObj }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert.equal(
          e.message,
          `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code ${errorObj.status} with message ${errorObj.statusText}. Please, try again later and if the error persists, report it.`
        );
      }
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['--quiet', '1'], null),
        {
          ...stubbedMethods,
          getRequestLog: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_REQUEST_LOGS_ERROR] There was an unexpected error when running request logs command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });
});

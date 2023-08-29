const assert = require('assert');
const sinon = require('sinon').createSandbox();
const RequestLogsCommand = require('../../../../../../src/commands/aem/rde/inspect/request-logs');
const { cli } = require('../../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../util.js');
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

describe('RequestLogsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#getRequestLogs', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new RequestLogsCommand([], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getRequestLogs.calledOnce, true);
    });

    it('Should produce the correct textual output.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
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
        new RequestLogsCommand(['-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[\n' +
          '  {"id":"0","method":"GET","path":"/metrics"},\n' +
          '  {"id":"1","method":"HEAD","path":"/libs/login.html"},\n' +
          '  {"id":"2","method":"GET","path":"/metrics"},\n' +
          '  {"id":"3","method":"HEAD","path":"/libs/login.html"}\n' +
          ']'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand([], null),
        { ...stubbedMethods, getRequestLogs: () => errorObj }
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
        new RequestLogsCommand([], null),
        {
          ...stubbedMethods,
          getRequestLogs: stubbedThrowErrorMethod,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });

  describe('#getRequestLog', function () {
    const reqId = '0';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new RequestLogsCommand([reqId], null),
      stubbedMethods
    );

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
        cli.log.getCapturedLogOutput(),
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
        new RequestLogsCommand(['0', '-o', 'json'], null),
        stubbedMethods
      );

      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "id": "0",\n' +
          '  "method": "HEAD",\n' +
          '  "path": "/libs/test.html",\n' +
          '  "log": [\n' +
          '    "log bla bli blu"\n' +
          '  ],\n' +
          '  "sling-request-log": [\n' +
          '    "      0 TIMER_START{Request Processing}",\n' +
          '    "      0 COMMENT timer_end format is {<elapsed microseconds>,<timer name>} <optional message>",\n' +
          '    "      3 LOG Method=HEAD, PathInfo=null"\n' +
          '  ]\n' +
          '}'
      );
    });

    it('Should print out a error message when status is not 200.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new RequestLogsCommand(['1'], null),
        { ...stubbedMethods, getRequestLog: () => errorObj }
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
        new RequestLogsCommand(['1'], null),
        {
          ...stubbedMethods,
          getRequestLog: stubbedThrowErrorMethod,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

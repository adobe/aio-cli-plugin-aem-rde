const assert = require('assert');
const sinon = require('sinon').createSandbox();
const SlingRequestsCommand = require('../../../../../src/commands/aem/rde/inspect/sling-requests');
const { cli } = require('../../../../../src/lib/base-command.js');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../util.js');
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
  getSlingRequest: () => {
    return Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              status: 200,
              id: '1',
              method: 'HEAD',
              path: '/libs/granite/core/content/login.html',
              log:
                '      0 TIMER_START{Request Processing}\n' +
                '      2 COMMENT timer_end format is {<elapsed microseconds>,<timer name>} <optional message>\n' +
                '     17 LOG Method=HEAD, PathInfo=null\n' +
                '   3403 LOG Calling filter: org.apache.sling.security.impl.ContentDispositionFilter\n' +
                '   3408 LOG Calling filter: com.adobe.granite.csrf.impl.CSRFFilter\n',
            }
          ),
      }
    );
  },
  getSlingRequests: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
          Object.assign(
            {},
            {
              status: '200',
              items: [
                {
                  id: '0',
                  method: 'HEAD',
                  path: '/libs/granite/core/content/login.html',
                },
                {
                  id: '1',
                  method: 'HEAD',
                  path: '/libs/granite/core/content/login.html',
                },
                {
                  id: '2',
                  method: 'HEAD',
                  path: '/libs/granite/core/content/login.html',
                },
                {
                  id: '3',
                  method: 'HEAD',
                  path: '/libs/granite/core/content/login.html',
                },
              ],
            }
          ),
      }
    ),
};

describe('SlingRequestsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#getSlingRequests', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new SlingRequestsCommand([], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getSlingRequests.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),

        [
          chalk.bold(
            ' ID     User ID Method Path                                  '
          ),
          chalk.bold(
            ' ────── ─────── ────── ───────────────────────────────────── '
          ),
          ' 0              HEAD   /libs/granite/core/content/login.html ',
          ' 1              HEAD   /libs/granite/core/content/login.html ',
          ' 2              HEAD   /libs/granite/core/content/login.html ',
          ' 3              HEAD   /libs/granite/core/content/login.html ',
        ].join('\n')
      );
    });

    it('Should have the expected json array result', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SlingRequestsCommand(['-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[\n' +
          '  {"id":"0","method":"HEAD","path":"/libs/granite/core/content/login.html"},\n' +
          '  {"id":"1","method":"HEAD","path":"/libs/granite/core/content/login.html"},\n' +
          '  {"id":"2","method":"HEAD","path":"/libs/granite/core/content/login.html"},\n' +
          '  {"id":"3","method":"HEAD","path":"/libs/granite/core/content/login.html"}\n' +
          ']'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SlingRequestsCommand([], null),
        { ...stubbedMethods, getSlingRequests: () => errorObj }
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
        new SlingRequestsCommand([], null),
        {
          ...stubbedMethods,
          getSlingRequests: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_SLING_REQUESTS_ERROR] There was an unexpected error when running get sling requests command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });

  describe('#getSlingRequest', function () {
    const reqId = '1';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new SlingRequestsCommand([reqId], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getSlingRequest.calledOnce, true);
    });

    it('Should be called with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getSlingRequest.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(
            ' ID     User ID Method Path                                  '
          ),
          chalk.bold(
            ' ────── ─────── ────── ───────────────────────────────────── '
          ),
          ' 1              HEAD   /libs/granite/core/content/login.html ',
        ].join('\n')
      );
    });

    it('Should produce the correct json output', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SlingRequestsCommand(['1', '-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n' +
          '  "status": 200,\n' +
          '  "id": "1",\n' +
          '  "method": "HEAD",\n' +
          '  "path": "/libs/granite/core/content/login.html",\n' +
          '  "log": "      0 TIMER_START{Request Processing}\\n      2 COMMENT timer_end format is {<elapsed microseconds>,<timer name>} <optional message>\\n     17 LOG Method=HEAD, PathInfo=null\\n   3403 LOG Calling filter: org.apache.sling.security.impl.ContentDispositionFilter\\n   3408 LOG Calling filter: com.adobe.granite.csrf.impl.CSRFFilter\\n"\n' +
          '}'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SlingRequestsCommand(['1'], null),
        { ...stubbedMethods, getSlingRequest: () => errorObj }
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

    it('Should catch a throw and print out a error message', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SlingRequestsCommand(['1'], null),
        {
          ...stubbedMethods,
          getSlingRequest: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_GET_SLING_REQUESTS_ERROR] There was an unexpected error when running get sling requests command. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });
});

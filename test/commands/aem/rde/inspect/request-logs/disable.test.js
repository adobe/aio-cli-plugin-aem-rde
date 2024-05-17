const assert = require('assert');
const sinon = require('sinon').createSandbox();
const DisableRequestLogsCommand = require('../../../../../../src/commands/aem/rde/inspect/request-logs/disable');
const { cli } = require('../../../../../../src/lib/base-command.js');
const Config = require('@adobe/aio-lib-core-config');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../../util.js');

const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethods = {
  disableRequestLogs: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  disableRequestLogs: () => errorObj,
};

const stubbedMethods = {
  disableRequestLogs: () =>
    Object.assign(
      {},
      {
        status: 200,
        enabled: false,
        names: [],
        paths: [],
        items: [],
      }
    ),
};

let command, cloudSdkApiStub;
describe('DisableRequestLogsCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#disableRequestLogs', function () {
    afterEach(() => {
      Config.get.restore();
    });

    beforeEach(() => {
      sinon
        .stub(Config, 'get')
        .withArgs('cloudmanager_orgid')
        .returns('1')
        .withArgs('cloudmanager_programid')
        .returns('1')
        .withArgs('cloudmanager_environmentid')
        .returns('1')
        .withArgs('cloudmanager_programname')
        .returns('programName')
        .withArgs('cloudmanager_environmentname')
        .returns('environmentName');

      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new DisableRequestLogsCommand([], null),
        stubbedMethods
      );
    });

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.disableRequestLogs.calledOnce, true);
    });

    it('Should return a message to the console if the disable action was successful', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        'Running DisableRequestLogsCommand on cm-p1-e1 (programName - environmentName)\n' +
          'Request-logs disabled.'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new DisableRequestLogsCommand(['--quiet'], null),
        stubbedErrorMethods
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
        new DisableRequestLogsCommand(['--quiet'], null),
        stubbedThrowErrorMethods
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_REQUEST_LOGS_DISABLE_ERROR] There was an unexpected error when running request logs command disable option. Please, try again later and if the error persists, report it.`
          )
        );
      }
    });
  });
});

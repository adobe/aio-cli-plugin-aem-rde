const assert = require('assert');
const sinon = require('sinon').createSandbox();

const { cli } = require('../../../../src/lib/base-command');
const HistoryCommand = require('../../../../src/commands/aem/rde/history.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../../../util');

const stubbedCloudSdkMethods = {
  getChanges: {
    status: 200,
    json: function () {
      return {
        items: [
          {
            updateId: 6,
            action: 'install',
            status: 'OK',
            metadata: {},
            timestamps: {},
          },
          {
            updateId: 8,
            action: 'delete',
            status: 'OK',
            metadata: {},
            timestamps: {},
          },
        ],
      };
    },
  },
  getChange: (id) =>
    Object.create({
      status: 200,
      headers: new Map(),
      json: () =>
        Object.create({
          updateId: id,
          action: 'install',
          status: 'OK',
          metadata: {},
          timestamps: {},
        }),
    }),
  getLogs: (id) =>
    Object.create({
      status: 200,
      text: () => 'logline',
    }),
};

let command, cloudSdkApiStub;

describe('HistoryCommand', function () {
  setupLogCapturing(sinon, cli);

  describe('#getChanges', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new HistoryCommand([], null),
        stubbedCloudSdkMethods
      );
    });

    it('should be called exactly once', async function () {
      await command.run();
      assert.ok(cloudSdkApiStub.getChanges.calledOnce);
    });

    it('should produce the correct log output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '#6: install OK - done by undefined at undefined\n' +
          '#8: delete OK - done by undefined at undefined'
      );
    });
  });

  describe('#getChange', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new HistoryCommand(['123'], null),
        stubbedCloudSdkMethods
      );
    });

    it('called the right remote API methods', async function () {
      await command.run();
      assert.ok(cloudSdkApiStub.getChange.calledOnceWithExactly('123'));
      assert.ok(cloudSdkApiStub.getLogs.calledOnceWithExactly('123'));
      assert.ok(
        cloudSdkApiStub.getChange.calledBefore(cloudSdkApiStub.getLogs)
      );
    });

    it('should produce the correct log output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '#123: install OK - done by undefined at undefined\n' +
          'Logs:\n' +
          '> logline'
      );
    });
  });
});

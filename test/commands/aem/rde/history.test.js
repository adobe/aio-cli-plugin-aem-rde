const assert = require('assert');
const sinon = require('sinon').createSandbox();

const { cli } = require('../../../../src/lib/base-command');
const HistoryCommand = require('../../../../src/commands/aem/rde/history.js');
const {setupLogCapturing, createCloudSdkAPIStub} = require("./util");


const stubbedCloudSdkMethods = {
  getChanges: sinon.fake(() => Object.create({
    status: 200,
    json: function() {
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
        ]
      };
    }
  })),
  getChange: id => Object.create({
    status: 200,
    headers: new Map(),
    json: () => Object.create({
      updateId: id,
      action: 'install',
      status: 'OK',
      metadata: {},
      timestamps: {},
    })
  }),
  getLogs: id => Object.create({
    status: 200,
    text: () => 'logline'
  })
};

describe('HistoryCommand', () => {

  setupLogCapturing(sinon, cli)

  describe('#run', () => {
    let [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, new HistoryCommand([], null), stubbedCloudSdkMethods);

    it('should call getChanges() exactly once', async () => {
      await command.run();
      assert.ok(cloudSdkApiStub.getChanges.calledOnce);
    });

    it('should produce the correct log output', async () => {
      await command.run();
      assert.equal(cli.log.getCapturedLogOutput(),
          "#6: install OK - done by undefined at undefined\n" +
          "#8: delete OK - done by undefined at undefined");
    });
  });

  describe('#run with id', () => {
    let [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, new HistoryCommand(['123'], null), stubbedCloudSdkMethods);

    it('called the right remote API methods', async () => {
      await command.run();
      assert.ok(cloudSdkApiStub.getChange.calledOnce)
      assert.ok(cloudSdkApiStub.getLogs.calledOnce)
    });

    it('should produce the correct log output', async () => {
      await command.run();
      assert.equal(cli.log.getCapturedLogOutput(),
          "#123: install OK - done by undefined at undefined\n" +
          "Logs:\n" +
          "> logline");
    });
  });
});

const assert = require('assert');
const sinon = require('sinon').createSandbox();
const Inventory = require('../../../../../src/commands/aem/rde/inspect/inventory');
const { cli } = require('../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../util.js');
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
  getInventory: async () =>
    Object.assign(
      {},
      {
        status: 200,
        json: async () =>
          Object.assign(
            {},
            {
              id: 'test',
              format: 'TEXT',
              contents: 'test',
            }
          ),
      }
    ),

  getInventories: async () =>
    Object.assign(
      {},
      {
        status: 200,
        json: async () =>
          Object.assign(
            {},
            {
              status: '200',
              items: [
                { id: 'test1', format: 'TEXT' },
                { id: 'test2', format: 'TEXT' },
                { id: 'test3', format: 'TEXT' },
              ],
            }
          ),
      }
    ),
};

describe('Inventory', function () {
  setupLogCapturing(sinon, cli);

  describe('#getInventories', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new Inventory([], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventories.calledOnce, true);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(' Format ID                  '),
          chalk.bold(' ────── ─────────────────── '),
          ' TEXT   test1               ',
          ' TEXT   test2               ',
          ' TEXT   test3               ',
        ].join('\n')
      );
    });

    it('Should have the expected json array result', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory(['-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '[\n' +
          '  {"id":"test1","format":"TEXT"},\n' +
          '  {"id":"test2","format":"TEXT"},\n' +
          '  {"id":"test3","format":"TEXT"}\n' +
          ']'
      );
    });

    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(sinon, new Inventory([], null), {
        ...stubbedMethods,
        getInventories: () => errorObj,
      });
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });

    it('Should catch a throw and print out a error message.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory([], null),

        {
          ...stubbedMethods,
          getInventories: stubbedThrowErrorMethod,
        }
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });

  describe('#getInventory', function () {
    const reqId = 'test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new Inventory([reqId], null),
      stubbedMethods
    );

    it('Should be called exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventory.calledOnce, true);
    });

    it('Should be called with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventory.args[0][1], reqId);
    });

    it('Should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        [
          chalk.bold(' Format ID                  '),
          chalk.bold(' ────── ─────────────────── '),
          ' TEXT   test                ',
        ].join('\n')
      );
    });

    it('Should produce the correct json output', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory(['0', '-o', 'json'], null),
        stubbedMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n  "id": "test",\n  "format": "TEXT",\n  "contents": "test"\n}'
      );
    });
    it('Should print out a error message when status is not 200', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory(['1'], null),

        { ...stubbedMethods, getInventory: () => errorObj }
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
        new Inventory(['1'], null),
        {
          ...stubbedMethods,
          getInventory: stubbedThrowErrorMethod,
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

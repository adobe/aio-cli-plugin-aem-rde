const assert = require('assert');
const sinon = require('sinon').createSandbox();
const Inventory = require('../../../../../src/commands/aem/rde/inspect/inventory');
const { cli } = require('../../../../../src/lib/base-command.js');
const {
  setupLogCapturing,
  createCloudSdkAPIStub,
} = require('../../../../util.js');
const chalk = require('chalk');

const errorObj = Object.create({
  status: 404,
  statusText: 'Test error message',
});

const stubbedThrowErrorMethod = () => {
  throw new Error(errorObj.statusText);
};

const stubbedMethods = {
  getInventory: {
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
  },

  getInventories: {
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
  },
};

let command, cloudSdkApiStub;
describe('Inventory', function () {
  setupLogCapturing(sinon, cli);

  describe('#getInventories', function () {
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new Inventory([], null),
        stubbedMethods
      );
    });

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
        new Inventory(['--json'], null),
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

    it('Should trigger an error', async function () {
      const [command] = createCloudSdkAPIStub(sinon, new Inventory([], null), {
        ...stubbedMethods,
        getInventories: () => errorObj,
      });
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

    it('Should throw an internal error when inventory config is null.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory([], null),

        {
          ...stubbedMethods,
          getInventories: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_INVENTORY_ERROR] There was an unexpected error when running inventory command. Please, try again later and if the error persists, report it.`,
            `Error message ${e.message} is not the expected one`
          )
        );
      }
    });
  });

  describe('#getInventory', function () {
    const reqId = 'test';
    beforeEach(() => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        new Inventory([reqId], null),
        stubbedMethods
      );
    });

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
        new Inventory(['0', '--json'], null),
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

    it('Should throw an internal error when config is null despite having non empty args.', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory(['1'], null),
        {
          ...stubbedMethods,
          getInventory: stubbedThrowErrorMethod,
        }
      );
      try {
        await command.run();
        assert.fail('Command should have failed with an exception');
      } catch (e) {
        assert(
          e.message.includes(
            `[RDECLI:INTERNAL_INVENTORY_ERROR] There was an unexpected error when running inventory command. Please, try again later and if the error persists, report it.`,
            `Error message ${e.message} is not the expected one`
          )
        );
      }
    });
  });
});

const assert = require('assert');
const sinon = require('sinon').createSandbox();
const Inventory = require('../../../../../src/commands/aem/rde/inspect/inventory');
const { cli } = require('../../../../../src/lib/base-command.js');
const { setupLogCapturing, createCloudSdkAPIStub } = require('../util.js');

/**
 * - return results as text
 * - return results as json
 * - if there is a id arg provided show only one result as text
 * - if there is a id arg provided show only one result as json
 * - catch error if throw happens in trycatch
 * - if status is not 200 print error all
 * - if status is not 200 print error with id
 */
const errorObj = Object.assign(
  {},
  {
    status: 404,
    statusText: 'Test error message.',
  }
);

const stubbedThrowErrorMethods = {
  getInventories: () => {
    throw new Error(errorObj.statusText);
  },
};
const stubbedErrorMethods = {
  getInventories: () => errorObj,
  getInventory: () => errorObj,
};

const stubbedMethods = {
  getInventory: () =>
    Object.assign(
      {},
      {
        status: 200,
        json: () =>
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

  getInventories: () =>
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

  describe('#run as textual results', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new Inventory([], null),
      stubbedMethods
    );

    it('should call getInventories() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventories.calledOnce, true);
    });

    it('should produce the correct textual output for getInventories.', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m Format ID                  \x1B[22m\n' +
          '\x1B[1m ────── ─────────────────── \x1B[22m\n' +
          ' TEXT   test1               \n' +
          ' TEXT   test2               \n' +
          ' TEXT   test3               '
      );
    });
  });

  describe('#run as json result for getInventories.', function () {
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new Inventory(['-o', 'json'], null),
      stubbedMethods
    );

    it('should call getInventories() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventories.calledOnce, true);
    });

    it('should have the expected json array result', async function () {
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
  });

  describe('#run specific (id) inventory as textual result', function () {
    const reqId = 'test';
    const [command, cloudSdkApiStub] = createCloudSdkAPIStub(
      sinon,
      new Inventory([reqId], null),
      stubbedMethods
    );

    it('should call getInventory() exactly once', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventory.calledOnce, true);
    });

    it('should call the getInventory() with an id argument', async function () {
      await command.run();
      assert.equal(cloudSdkApiStub.getInventory.args[0][1], reqId);
    });

    it('should produce the correct textual output', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '\x1B[1m Format ID                  \x1B[22m\n' +
          '\x1B[1m ────── ─────────────────── \x1B[22m\n' +
          ' TEXT   test                '
      );
    });
  });
  describe('#run specific (id) inventory as json result', function () {
    const [command] = createCloudSdkAPIStub(
      sinon,
      new Inventory(['0', '-o', 'json'], null),
      stubbedMethods
    );
    it('should produce the correct json output for a inventory', async function () {
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        '{\n  "id": "test",\n  "format": "TEXT",\n  "contents": "test"\n}'
      );
    });
  });

  describe('#handle error cases', function () {
    it('Should print out a error message when status is not 200 (all inventories).', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory([], null),
        stubbedErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.status} - ${errorObj.statusText}`
      );
    });
    it('Should print out a error message when status is not 200. (one inventory [id])', async function () {
      const [command] = createCloudSdkAPIStub(
        sinon,
        new Inventory(['1'], null),
        stubbedErrorMethods
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
        new Inventory([], null),
        stubbedThrowErrorMethods
      );
      await command.run();
      assert.equal(
        cli.log.getCapturedLogOutput(),
        `Error: ${errorObj.statusText}`
      );
    });
  });
});

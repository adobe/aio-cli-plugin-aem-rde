const assert = require('assert');
const sinon = require('sinon').createSandbox();
const SetupCommand = require('../../../../../src/commands/aem/rde/inspect/setup');
const { codes: libError } = require('../../../../../src/lib/errors');
const Config = require('@adobe/aio-lib-core-config');
const { createCloudSdkAPIStub } = require('../util.js');

describe('SetupCommand', function () {
  before(() => sinon.replace(Config, 'set', sinon.fake()));
  after(() => sinon.restore());
  beforeEach(() => Config.set.resetHistory());

  // sets a fix timestamp as 'now'
  sinon.useFakeTimers({
    now: 1687612336371,
  });

  describe('Check error cases.', function () {
    it('should validate the token and throw error if not valid', async function () {
      const errorCanNotDecode = new libError.CLI_AUTH_CONTEXT_CANNOT_DECODE();
      const token = 'not valid token';
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SetupCommand([token], null)
      );

      sinon.assert.notCalled(Config.set);
      assert.rejects(command.run);

      // checks if the right error is thrown
      try {
        await command.run();
        assert.fail('error');
      } catch (error) {
        assert.equal(error.message, errorCanNotDecode.message);
        assert.equal(error.code, errorCanNotDecode.code);
      }
    });

    it('shoud print out an error if no expiry date is created.', async function () {
      const tokenNoExpiryError = new libError.TOKEN_HAS_NO_EXPIRY();
      // this token has no created_at key, value so it will cause an error
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJkZXYtY29uc29sZS1zdGFnZSIsInVzZXJfaWQiOiIzOTUyMzA0OTMwOTRCQUJFNTBBNDk0MjBFQGY3MTI2MWY0NjI2OTI3MDU0OTQxMjguZSIsInN0YXRlIjoia010djd4SnNhSDZkOFpEb0RydVJ6MEZqIiwiYXMiOiJpbXMtbmExLXN0ZzEiLCJhYV9pZCI6IjhFRDYxRThBNUNEYXNkZmFzZGZFQGM2MmYyNGNjNWI1YjdlMGUwYTQ5NDAwNCIsImN0cCI6MCwiZmciOiJYUlFWVTIzNEFFUkdBNkRaN0dTREZHSUFTQSIsInNpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInJ0aWQiOiIxNjg3NDI2MjM1NjYwXzlzZTgwZTRkLTkxNDYtNGU4Ny1hMGJ3LTk4ZGIxZWZkYWE3NF9hcjUiLCJtb2kiOiJlYXdkc2ZjODMiLCJwYmEiOiJ4eCx4eCIsInJ0ZWEiOiIxNjg4NjM1ODM1NjYxIiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwic2NvcGUiOiJ4eHgifQ.Gm2Zzibsb2XcD5_bgec6Z1oGPwbgElhLVQJEHHnJWW0';
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SetupCommand([token], null)
      );

      sinon.assert.notCalled(Config.set);
      assert.rejects(command.run);

      // checks if the right error is thrown
      try {
        await command.run();
        assert.fail('error');
      } catch (error) {
        assert.equal(error.message, tokenNoExpiryError.message);
        assert.equal(error.code, tokenNoExpiryError.code);
      }
    });

    it('shoud print out an error if token is expired.', async function () {
      const tokenIsExpiredError = new libError.TOKEN_IS_EXPIRED();
      // this token has an outdated created_at value, so it will cause an error
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJkZXYtY29uc29sZS1zdGFnZSIsInVzZXJfaWQiOiIzOTUyMzA0OTMwOTRCQUJFNTBBNDk0MjBFQGY3MTI2MWY0NjI2OTI3MDU0OTQxMjguZSIsInN0YXRlIjoia010djd4SnNhSDZkOFpEb0RydVJ6MEZqIiwiYXMiOiJpbXMtbmExLXN0ZzEiLCJhYV9pZCI6IjhFRDYxRThBNUNEYXNkZmFzZGZFQGM2MmYyNGNjNWI1YjdlMGUwYTQ5NDAwNCIsImN0cCI6MCwiZmciOiJYUlFWVTIzNEFFUkdBNkRaN0dTREZHSUFTQSIsInNpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInJ0aWQiOiIxNjg3NDI2MjM1NjYwXzlzZTgwZTRkLTkxNDYtNGU4Ny1hMGJ3LTk4ZGIxZWZkYWE3NF9hcjUiLCJtb2kiOiJlYXdkc2ZjODMiLCJwYmEiOiJ4eCx4eCIsInJ0ZWEiOiIxNjg4NjM1ODM1NjYxIiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwiY3JlYXRlZF9hdCI6IjE2ODc5NTI0NDIiLCJzY29wZSI6Inh4eCJ9.JoBLMd-FdGgtr851VsaTOKMhsuAagAoZOaKEtmY8fAk';
      const [command] = createCloudSdkAPIStub(
        sinon,
        new SetupCommand([token], null)
      );

      sinon.assert.notCalled(Config.set);
      assert.rejects(command.run);

      // checks if the right error is thrown
      try {
        await command.run();
        assert.fail('error');
      } catch (error) {
        assert.equal(error.message, tokenIsExpiredError.message);
        assert.equal(error.code, tokenIsExpiredError.code);
      }
    });
  });

  describe('#run get the access token for the inspect topic requests.', function () {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInR5cGUiOiJhY2Nlc3NfdG9rZW4iLCJjbGllbnRfaWQiOiJkZXYtY29uc29sZS1zdGFnZSIsInVzZXJfaWQiOiIzOTUyMzA0OTMwOTRCQUJFNTBBNDk0MjBFQGY3MTI2MWY0NjI2OTI3MDU0OTQxMjguZSIsInN0YXRlIjoia010djd4SnNhSDZkOFpEb0RydVJ6MEZqIiwiYXMiOiJpbXMtbmExLXN0ZzEiLCJhYV9pZCI6IjhFRDYxRThBNUNEYXNkZmFzZGZFQGM2MmYyNGNjNWI1YjdlMGUwYTQ5NDAwNCIsImN0cCI6MCwiZmciOiJYUlFWVTIzNEFFUkdBNkRaN0dTREZHSUFTQSIsInNpZCI6IjE2ODc0MjYyMzU2NjBfOXNlODBlNGQtOTE0Ni00ZTg3LWEwYnctOThkYjFlZmRhYTc0X2FyNSIsInJ0aWQiOiIxNjg3NDI2MjM1NjYwXzlzZTgwZTRkLTkxNDYtNGU4Ny1hMGJ3LTk4ZGIxZWZkYWE3NF9hcjUiLCJtb2kiOiJlYXdkc2ZjODMiLCJwYmEiOiJ4eCx4eCIsInJ0ZWEiOiIxNjg4NjM1ODM1NjYxIiwiZXhwaXJlc19pbiI6Ijg2NDAwMDAwIiwiY3JlYXRlZF9hdCI6IjE2ODc2MTIzMzYzNzEiLCJzY29wZSI6Inh4eCJ9.yvZlRere2RySx60soThFaky9l-elXWCkMNl62TCYusU';
    const [command] = createCloudSdkAPIStub(
      sinon,
      new SetupCommand([token], null)
    );

    const expiry = 1687698736371;

    it('Should set the token and expiry to the config file.', async function () {
      await command.run();
      assert.equal('aem-rde.inspect.ims_access_token', Config.set.args[0][0]);
      assert.equal(token, Config.set.args[0][1].token);
      assert.equal(expiry, Config.set.args[0][1].expiry);
      sinon.assert.calledOnce(Config.set);
    });
  });
});

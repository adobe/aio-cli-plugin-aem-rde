const assert = require('assert');
const RdeUtils = require('../../src/lib/rde-utils.js');
const sinon = require('sinon').createSandbox();
const {
  codes: deploymentErrorCodes,
} = require('../../src/lib/deployment-errors');

describe('RdeUtils', function () {
  describe('#groupArtifacts', function () {
    const arts = [
      {
        id: 'test.bundle.auth',
        updateId: '6',
        service: 'author',
        type: 'osgi-bundle',
      },
      {
        id: 'test.config.pblsh',
        updateId: '6',
        service: 'publish',
        type: 'osgi-config',
      },
      {
        id: 'test.config.auth',
        updateId: '6',
        service: 'author',
        type: 'osgi-config',
      },
    ];
    const grouped = RdeUtils.groupArtifacts(arts);

    it('author has 1 bundle and 1 config', function () {
      assert.equal(1, grouped.author['osgi-bundle'].length);
      assert.equal('test.bundle.auth', grouped.author['osgi-bundle'][0].id);
      assert.equal(1, grouped.author['osgi-config'].length);
      assert.equal('test.config.auth', grouped.author['osgi-config'][0].id);
    });

    it('publish has only 1 config', function () {
      assert.equal(0, grouped.publish['osgi-bundle'].length);
      assert.equal(1, grouped.publish['osgi-config'].length);
      assert.equal('test.config.pblsh', grouped.publish['osgi-config'][0].id);
      assert.equal('6', grouped.publish['osgi-config'][0].updateId);
      assert.equal('publish', grouped.publish['osgi-config'][0].service);
      assert.equal('osgi-config', grouped.publish['osgi-config'][0].type);
    });
  });
  describe('#throwOnInstallError', function () {
    it('install failed', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({ status: 'failed' })),
          status: 200,
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
      };
      let err;
      try {
        await RdeUtils.throwOnInstallError(cloudSdk, 'update-id', () => {});
      } catch (e) {
        err = e;
      }
      assert.equal(err?.code, 'INSTALL_FAILED');
    });
    it('staged', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({ status: 'staged' })),
          status: 200,
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
      };
      let err;
      try {
        await RdeUtils.throwOnInstallError(cloudSdk, 'update-id', () => {});
      } catch (e) {
        err = e;
      }
      assert.equal(err?.code, 'INSTALL_STAGED');
    });
    it('no error throwing', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({ status: '400' })),
          status: 200,
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
      };
      let err;
      try {
        await RdeUtils.throwOnInstallError(cloudSdk, 'update-id', () => {});
      } catch (e) {
        err = e;
      }
      assert.equal(err, undefined);
    });
    it('throw generic error', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({})),
          status: 400,
          statusText: 'an error occurred',
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
      };
      let err;
      try {
        await RdeUtils.throwOnInstallError(cloudSdk, 'update-id', () => {});
      } catch (e) {
        err = e;
      }
      assert.equal(
        err?.message,
        `cannot check command operation status, error code 400 and error message an error occurred`
      );
    });
  });
  describe('#loadUpdateHistory', function () {
    it('should throw UNEXPECTED_API_ERROR', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({})),
          status: 200,
        })
      );
      const getLogsFn = sinon.stub().returns(
        Promise.resolve({
          status: 400,
          statusText: 'an error occurred',
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
        getLogs: getLogsFn,
      };
      const cliLogFn = sinon.spy(sinon.stub());
      let err;
      try {
        await RdeUtils.loadUpdateHistory(
          cloudSdk,
          'update-id',
          { log: cliLogFn },
          () => {}
        );
      } catch (e) {
        err = e;
      }
      assert.equal(
        err.message,
        `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code 400 with message an error occurred. Please, try again later and if the error persists, report it.`
      );
    });
    it('should log not found', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({})),
          status: 404,
        })
      );
      const getLogsFn = sinon.stub().returns(
        Promise.resolve({
          status: 404,
          statusText: 'an error occurred',
        })
      );
      const cloudSdk = {
        getChange: getChangeFn,
        getLogs: getLogsFn,
      };
      const cliLogFn = sinon.spy(sinon.stub());
      await RdeUtils.loadUpdateHistory(
        cloudSdk,
        'update-id',
        { log: cliLogFn },
        () => {}
      );
      assert.equal(
        cliLogFn.calledWith('An update with ID update-id does not exist.'),
        true
      );
    });
    it('should throw UNEXPECTED_API_ERROR if response status is incorrect', async function () {
      const getChangeFn = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: () => undefined,
          },
          json: sinon.stub().returns(Promise.resolve({})),
          status: 400,
        })
      );
      const getLogsFn = sinon.stub().returns(Promise.resolve({}));
      const cloudSdk = {
        getChange: getChangeFn,
        getLogs: getLogsFn,
      };
      const cliLogFn = sinon.spy(sinon.stub());
      let err;
      try {
        await RdeUtils.loadUpdateHistory(
          cloudSdk,
          'update-id',
          { log: cliLogFn },
          () => {}
        );
      } catch (e) {
        err = e;
      }
      assert.equal(
        err.message,
        `[RDECLI:UNEXPECTED_API_ERROR] There was an unexpected API error code 400 with message undefined. Please, try again later and if the error persists, report it.`
      );
    });
  });
  describe('#handleRetryAfter', function () {
    it('should sleep', async function () {
      const clock = sinon.useFakeTimers();
      const mutableRequestClosure = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: sinon.stub().returns(1),
          },
        })
      );
      const requestClosure = sinon.stub().returns(
        Promise.resolve({
          headers: {
            get: sinon.stub().returns(undefined),
          },
        })
      );
      const beforeSleepCallback = sinon.stub();
      let isResolved = false;
      RdeUtils.handleRetryAfter(
        mutableRequestClosure,
        requestClosure,
        beforeSleepCallback
      ).then(() => (isResolved = true));
      await clock.tickAsync(2000);
      assert.equal(isResolved, true);
      assert.equal(beforeSleepCallback.calledOnce, true);
    });
  });
});

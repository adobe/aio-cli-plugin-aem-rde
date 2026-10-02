const assert = require('node:assert/strict');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { concatEnvironemntId } = require('../../src/lib/utils');

const fetch = sinon.stub();
const sleep = sinon.stub().resolves();
const uploadFile = sinon.stub().resolves();
const copyFromUrl = sinon.stub();
const sasUrls = [];
const { DoRequest } = proxyquire('../../src/lib/doRequest', {
  '@adobe/aio-lib-core-networking': { createFetch: () => fetch },
  './utils': { sleepSeconds: sleep },
});
const { CloudSdkAPI } = proxyquire('../../src/lib/cloud-sdk-api', {
  '@adobe/aio-lib-core-networking': { createFetch: () => fetch },
  '@azure/storage-file-share': {
    ShareFileClient: class {
      constructor(url) {
        sasUrls.push(url);
      }
      uploadFile(...args) {
        return uploadFile(...args);
      }
      startCopyFromURL(...args) {
        return copyFromUrl(...args);
      }
    },
  },
  './doRequest': { DoRequest },
  './utils': { sleepSeconds: sleep, concatEnvironemntId },
  './rde-utils': {
    handleRetryAfter: async (start, poll) => {
      const previous = start ? await start() : undefined;
      return poll(previous);
    },
  },
});

const origin = 'https://author-p123-e456.adobeaemcloud.com';
const prefix = '/adobe/experimental/devconsole-expires-20261015/devconsole';
const apiBase = origin + prefix;
const consoleBase = 'https://dev-console.example.invalid';
const cmBase = 'https://cloudmanager.adobe.io/api/program/123/environment/456';
const sasUrl = 'https://storage.example.invalid/update?sig=test';

function response(status = 200, json = {}, headers = {}) {
  return {
    status,
    statusText: 'test response',
    headers: { get: (name) => headers[name] },
    json: async () => json,
    text: async () => JSON.stringify(json),
  };
}

function client(apiFirst = true) {
  return new CloudSdkAPI(
    cmBase,
    apiFirst ? apiBase : consoleBase,
    `${consoleBase}/api/rde`,
    'test-api-key',
    'test-org',
    '123',
    '456',
    'test-token',
    { 'x-enable-experimental-features': 'snapshots' },
    apiFirst
  );
}

describe('CloudSdkAPI routing', function () {
  beforeEach(function () {
    fetch.reset();
    sleep.resetHistory();
    uploadFile.resetHistory();
    copyFromUrl.reset();
    copyFromUrl.resolves({ copyId: 'copy', copyStatus: 'success' });
    sasUrls.length = 0;
    fetch.resolves(response());
  });

  for (const apiFirst of [false, true]) {
    const runtimeBase = apiFirst
      ? `${apiBase}/runtime`
      : `${consoleBase}/api/rde/program/123/environment/456/runtime`;
    const updatesBase = apiFirst
      ? `${apiBase}/rde-updates`
      : `${runtimeBase}/updates`;
    const snapshotsBase = apiFirst
      ? `${apiBase}/rde-snapshots`
      : `${consoleBase}/api/rde/snapshots`;

    describe(apiFirst ? 'API-first' : 'legacy compatibility', function () {
      for (const [name, args, method, path] of [
        [
          'getAemLogs',
          ['publish', { filter: 'custom' }],
          'get',
          '/publish/logs?filter=custom',
        ],
        ['getAemLog', ['author', 'log/1'], 'get', '/author/logs/log%2F1'],
        ['getAemLogTail', ['preview', '1'], 'get', '/preview/logs/1/tail'],
        ['createAemLog', ['author', { names: [] }], 'post', '/author/logs'],
        ['deleteAemLog', ['publish', '1'], 'delete', '/publish/logs/1'],
        ['getRequestLogs', ['author', {}], 'get', '/author/request-logs?'],
        ['getRequestLog', ['author', '1'], 'get', '/author/request-logs/1'],
        [
          'enableRequestLogs',
          ['author', { includePathPatterns: ['.*'] }],
          'post',
          '/author/request-logs',
        ],
        ['disableRequestLogs', ['author'], 'delete', '/author/request-logs'],
        ['getInventories', ['author', {}], 'get', '/author/inventory?'],
        ['getInventory', ['author', '1'], 'get', '/author/inventory/1'],
        [
          'getOsgiBundles',
          ['author', { scope: 'custom' }],
          'get',
          '/author/osgi-bundles?scope=custom',
        ],
        ['getOsgiBundle', ['author', '1'], 'get', '/author/osgi-bundles/1'],
        [
          'getOsgiComponents',
          ['author', {}],
          'get',
          '/author/osgi-components?',
        ],
        [
          'getOsgiComponent',
          ['author', 'component/name'],
          'get',
          '/author/osgi-components/component%2Fname',
        ],
        [
          'getOsgiConfigurations',
          ['author', {}],
          'get',
          '/author/osgi-configurations?',
        ],
        [
          'getOsgiConfiguration',
          ['author', 'config/pid'],
          'get',
          '/author/osgi-configurations/config%2Fpid',
        ],
        ['getOsgiServices', ['author', {}], 'get', '/author/osgi-services?'],
        ['getOsgiService', ['author', '1'], 'get', '/author/osgi-services/1'],
      ]) {
        it(`routes ${name} with its existing authentication and payload`, async function () {
          await client(apiFirst)[name](...args);
          assert.equal(fetch.callCount, 1);
          const [url, options] = fetch.firstCall.args;
          assert.equal(url, runtimeBase + path);
          assert.equal(options.method, method);
          assert.equal(options.headers.Authorization, 'Bearer test-token');
          assert.equal(
            options.headers['x-enable-experimental-features'],
            'snapshots'
          );
          if (method === 'post') {
            assert.deepEqual(JSON.parse(options.body), args[1]);
          }
        });
      }

      for (const [name, args, path] of [
        ['getChanges', [], ''],
        ['getChange', ['update/1'], '/update%2F1'],
        ['getStatus', [], '/artifacts'],
        ['getArtifacts', ['next cursor'], '/artifacts?cursor=next+cursor'],
        ['getLogs', ['1'], '/1/logs'],
      ]) {
        it(`routes ${name} through the updates collection`, async function () {
          await client(apiFirst)[name](...args);
          assert.equal(fetch.firstCall.args[0], updatesBase + path);
          assert.equal(fetch.firstCall.args[1].method, 'get');
        });
      }

      for (const [name, args, method, path] of [
        ['getSnapshots', [], 'get', '?programId=123&environmentId=456'],
        [
          'createSnapshot',
          ['test', { description: 'my snapshot' }],
          'post',
          '?description=my+snapshot&snapshot-name=test&programId=123&environmentId=456',
        ],
        [
          'deleteSnapshot',
          ['test/name', true],
          'delete',
          '/test%2Fname?force=true&programId=123&environmentId=456',
        ],
        [
          'undeleteSnapshot',
          ['test/name'],
          'put',
          '/test%2Fname?programId=123&environmentId=456',
        ],
        [
          'restoreSnapshot',
          ['test/name', { 'only-mutable-content': true }],
          'post',
          '/test%2Fname/restore?programId=123&environmentId=456',
        ],
      ]) {
        it(`routes ${name} with snapshot identity and wire properties preserved`, async function () {
          await client(apiFirst)[name](...args);
          const [url, options] = fetch.firstCall.args;
          assert.equal(url, snapshotsBase + path);
          assert.equal(options.method, method);
          if (name === 'restoreSnapshot') {
            assert.deepEqual(JSON.parse(options.body), {
              'only-mutable-content': true,
            });
          }
        });
      }
    });
  }

  it('polls snapshot progress on rde-runtime with the existing action parameters', async function () {
    await client().getSnapshotProgress(
      'snapshot_create',
      'test snapshot',
      '123'
    );
    assert.equal(
      fetch.firstCall.args[0],
      `${apiBase}/rde-runtime/status?programId=123&environmentId=456&snapshot-name=test+snapshot&action=snapshot_create&actionid=123`
    );
  });

  it('polls the release-scoped state without namespace discovery', async function () {
    fetch
      .onFirstCall()
      .resolves(response(200, { status: { releaseState: 'starting' } }));
    fetch
      .onSecondCall()
      .resolves(response(200, { status: { releaseState: 'running' } }));
    assert.equal(await client()._waitForEnv(undefined, 'running'), 'running');
    assert(
      fetch
        .getCalls()
        .every((call) => call.args[0] === `${apiBase}/releases/status`)
    );
    assert(sleep.calledWith(10));
  });

  it('rejects a legacy status payload instead of silently polling it forever', async function () {
    fetch.resolves(response(200, { releases: { status: {} } }));
    await assert.rejects(client()._waitForEnv(undefined, 'running'), {
      code: 'UNEXPECTED_API_ERROR',
    });
  });

  for (const [action, initial, final] of [
    ['startEnv', 'hibernated', 'running'],
    ['stopEnv', 'running', 'hibernated'],
  ]) {
    it(`uses API-first lifecycle requests for ${action}`, async function () {
      let state = initial;
      fetch.callsFake(async (url, options) => {
        if (options.method === 'post') {
          state = final;
          return response(200, { ok: true });
        }
        return response(200, { status: { releaseState: state } });
      });
      await client()[action]();
      const operation = action === 'startEnv' ? 'dehibernate' : 'hibernate';
      assert(
        fetch
          .getCalls()
          .some((call) => call.args[0] === `${apiBase}/releases/${operation}`)
      );
      assert(
        fetch.getCalls().every((call) => call.args[0].startsWith(apiBase))
      );
    });
  }

  for (const action of ['restartEnv', 'resetEnv']) {
    it(`completes ${action} without namespace discovery and preserves reset flags`, async function () {
      fetch.callsFake(async (url, options) =>
        response(options.method === 'post' ? 201 : 200, {
          status: { releaseState: 'running' },
        })
      );
      await client()[action](true, true, false);
      const post = fetch
        .getCalls()
        .find((call) => call.args[1].method === 'post');
      assert.equal(
        post.args[0],
        `${apiBase}/rde-runtime/${action === 'restartEnv' ? 'restart' : 'reset'}`
      );
      assert.deepEqual(
        JSON.parse(post.args[1].body),
        action === 'restartEnv'
          ? {}
          : {
              'keep-mutable-content': true,
              force: false,
            }
      );
      assert(
        fetch.getCalls().every((call) => call.args[0].startsWith(apiBase))
      );
      assert.equal(
        fetch
          .getCalls()
          .filter((call) => call.args[0] === `${apiBase}/releases/status`)
          .length,
        3
      );
    });
  }

  it('keeps the default reset and its readiness polling on Cloud Manager', async function () {
    fetch.callsFake(async () => response(200, { status: 'ready' }));
    assert.equal(await client().resetEnv(true, false, false), 'ready');
    assert(
      fetch
        .getCalls()
        .some(
          (call) =>
            call.args[0] === `${cmBase}/reset` && call.args[1].method === 'put'
        )
    );
    assert.equal(
      fetch.getCalls().filter((call) => call.args[0] === cmBase).length,
      2
    );
    assert(
      fetch
        .getCalls()
        .every(
          (call) =>
            call.args[0] === cmBase ||
            call.args[0] === `${cmBase}/reset` ||
            call.args[0].startsWith(`${apiBase}/rde-updates`)
        )
    );
  });

  it('retains Azure SAS uploads and API-first update start/polling', async function () {
    const callbacks = {
      start: sinon.spy(),
      progress: sinon.spy(),
      abort: sinon.spy(),
    };
    fetch
      .onFirstCall()
      .resolves(response(201, { updateId: '1' }, { Location: sasUrl }));
    fetch.onSecondCall().resolves(response(202, { updateId: '1' }));
    fetch
      .onThirdCall()
      .resolves(response(200, { updateId: '1', status: 'completed' }));
    await client().deployFile(
      100,
      '/tmp/test.jar',
      'test.jar',
      'osgi-bundle',
      'author',
      undefined,
      false,
      callbacks,
      () => {}
    );
    assert.deepEqual(sasUrls, [sasUrl]);
    assert.equal(uploadFile.firstCall.args[0], '/tmp/test.jar');
    assert(callbacks.start.calledOnceWithExactly(100));
    assert.deepEqual(
      fetch.getCalls().map((call) => [call.args[0], call.args[1].method]),
      [
        [`${apiBase}/rde-updates`, 'post'],
        [`${apiBase}/rde-updates/1`, 'put'],
        [`${apiBase}/rde-updates/1`, 'get'],
      ]
    );
    assert.deepEqual(JSON.parse(fetch.firstCall.args[1].body), {
      service: 'author',
      fileSize: 100,
      type: 'osgi-bundle',
      metadata: { name: 'test.jar' },
      force: false,
    });
  });

  it('retains Azure URL-copy deployment', async function () {
    const callbacks = {
      start: sinon.spy(),
      progress: sinon.spy(),
      abort: sinon.spy(),
    };
    fetch
      .onFirstCall()
      .resolves(response(201, { updateId: '1' }, { Location: sasUrl }));
    fetch.onSecondCall().resolves(response(202, { updateId: '1' }));
    fetch
      .onThirdCall()
      .resolves(response(200, { updateId: '1', status: 'completed' }));
    await client().deployURL(
      100,
      'https://download.example.invalid/test.jar',
      'test.jar',
      'osgi-bundle',
      'author',
      undefined,
      false,
      callbacks,
      () => {}
    );
    assert.deepEqual(sasUrls, [sasUrl]);
    assert.equal(
      copyFromUrl.firstCall.args[0],
      'https://download.example.invalid/test.jar'
    );
    assert(callbacks.start.calledOnceWithExactly(100));
    assert(
      fetch
        .getCalls()
        .every((call) => call.args[0].startsWith(`${apiBase}/rde-updates`))
    );
  });

  it('tracks artifact deletion through the returned update id', async function () {
    fetch.onFirstCall().resolves(response(202, { updateId: '1' }));
    fetch
      .onSecondCall()
      .resolves(response(200, { updateId: '1', status: 'completed' }));
    await client().delete('artifact/name', true);
    assert.equal(
      fetch.firstCall.args[0],
      `${apiBase}/rde-updates/artifacts/artifact%2Fname?force=true`
    );
    assert.equal(fetch.firstCall.args[1].method, 'delete');
    assert.equal(fetch.secondCall.args[0], `${apiBase}/rde-updates/1`);
  });

  for (const action of ['restartEnv', 'resetEnv']) {
    it(`preserves legacy namespace discovery and lifecycle polling for ${action}`, async function () {
      fetch.callsFake(async (url, options) => {
        if (url === `${consoleBase}/api/status`) {
          return response(200, { availableNamespaces: ['test-namespace'] });
        }
        return response(options.method === 'post' ? 201 : 200, {
          releases: { status: { 'cm-p123-e456': { releaseState: 'running' } } },
        });
      });
      await client(false)[action](true, true, false);
      assert(
        fetch
          .getCalls()
          .some((call) => call.args[0] === `${consoleBase}/api/status`)
      );
      assert.equal(
        fetch
          .getCalls()
          .filter(
            (call) =>
              call.args[0] ===
              `${consoleBase}/api/releases/test-namespace/status`
          ).length,
        3
      );
      assert(
        fetch.getCalls().every((call) => call.args[0].startsWith(consoleBase))
      );
    });
  }

  it('keeps a forced reset on rde-runtime even without preserving mutable content', async function () {
    fetch.callsFake(async (url, options) =>
      response(options.method === 'post' ? 201 : 200, {
        status: { releaseState: 'running' },
      })
    );
    await client().resetEnv(true, false, true);
    const post = fetch
      .getCalls()
      .find((call) => call.args[1].method === 'post');
    assert.equal(post.args[0], `${apiBase}/rde-runtime/reset`);
    assert.deepEqual(JSON.parse(post.args[1].body), {
      'keep-mutable-content': false,
      force: true,
    });
    assert(fetch.getCalls().every((call) => call.args[0].startsWith(apiBase)));
  });

  it('surfaces gateway errors without a legacy fallback', async function () {
    fetch.resolves(response(403));
    await assert.rejects(client().getChanges(), { code: 'HTTP_ERROR' });
    assert(
      fetch
        .getCalls()
        .every((call) => call.args[0] === `${apiBase}/rde-updates`)
    );
  });
});

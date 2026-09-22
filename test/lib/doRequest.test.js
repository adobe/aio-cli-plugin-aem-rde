const assert = require('node:assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const FormData = require('form-data');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fetchStub = sinon.spy(
  sinon.stub().returns(Promise.resolve({ status: 200, response: 'ok' }))
);
const { DoRequest, withRetries } = proxyquire('../../src/lib/doRequest', {
  '@adobe/aio-lib-core-networking': {
    createFetch: function () {
      return fetchStub;
    },
  },
});

describe('doRequest', function () {
  afterEach(() => {
    fetchStub.resetHistory();
  });
  it('doGet', async function () {
    const dr = new DoRequest('http://example.com');
    const result = await dr.doGet('/', {});
    assert.equal(fetchStub.callCount, 1);
    const [url, options] = fetchStub.firstCall.args;
    assert.equal(url, 'http://example.com/');
    assert.equal(options.method, 'get');
    assert.equal(options.body, '{}');
    assert.equal(options.headers['content-type'], 'application/json');
    assert.match(options.headers['x-request-id'], UUID_RE);
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doGet reuses one request id across retries and reports the HTTP status on failure', async function () {
    const failingStub = sinon
      .stub()
      .returns(Promise.resolve({ status: 500, statusText: 'boom' }));
    const { DoRequest: RetryingDoRequest } = proxyquire(
      '../../src/lib/doRequest',
      {
        '@adobe/aio-lib-core-networking': {
          createFetch: function () {
            return failingStub;
          },
        },
        './utils': { sleepSeconds: sinon.stub().resolves() },
      }
    );
    const dr = new RetryingDoRequest('http://example.com');
    let err;
    try {
      await dr.doGet('/', {});
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, 'HTTP_ERROR');
    assert.match(err.message, /500/);
    assert.match(err.message, /boom/);
    const requestIds = failingStub
      .getCalls()
      .map((call) => call.args[1].headers['x-request-id']);
    assert.equal(new Set(requestIds).size, 1);
    assert.ok(err.message.includes(requestIds[0]));
  });
  it('doGet throws NETWORK_ERROR with a request id when no response is received', async function () {
    const noResponseStub = sinon.stub().returns(Promise.resolve(undefined));
    const { DoRequest: FailingDoRequest } = proxyquire(
      '../../src/lib/doRequest',
      {
        '@adobe/aio-lib-core-networking': {
          createFetch: function () {
            return noResponseStub;
          },
        },
        './utils': { sleepSeconds: sinon.stub().resolves() },
      }
    );
    const dr = new FailingDoRequest('http://example.com');
    let err;
    try {
      await dr.doGet('/', {});
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, 'NETWORK_ERROR');
    assert.match(err.message, /x-request-id: [0-9a-f-]{36}/i);
  });
  it('surfaces a TLS_ERROR with a NODE_EXTRA_CA_CERTS hint when the handshake fails', async function () {
    // global fetch masks transport failures as 'fetch failed' and puts the
    // real reason on `cause`, which is what an intercepting proxy produces
    const tlsError = new TypeError('fetch failed');
    tlsError.cause = Object.assign(
      new Error('unable to verify the first certificate'),
      { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }
    );
    const tlsStub = sinon.stub().rejects(tlsError);
    const { DoRequest: TlsDoRequest } = proxyquire('../../src/lib/doRequest', {
      '@adobe/aio-lib-core-networking': {
        createFetch: function () {
          return tlsStub;
        },
      },
      './utils': { sleepSeconds: sinon.stub().resolves() },
    });
    const dr = new TlsDoRequest('http://example.com');
    let err;
    try {
      await dr.doGet('/', {});
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, 'TLS_ERROR');
    assert.match(err.message, /UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
    assert.match(err.message, /unable to verify the first certificate/);
    assert.match(err.message, /NODE_EXTRA_CA_CERTS/);
    assert.match(err.message, /x-request-id: [0-9a-f-]{36}/i);
  });
  it('surfaces a CONNECTION_ERROR for non-TLS transport failures', async function () {
    // node-fetch style error, where the code sits directly on the error
    const connError = Object.assign(
      new Error('connect ECONNREFUSED 10.0.0.1:83'),
      { code: 'ECONNREFUSED' }
    );
    const connStub = sinon.stub().rejects(connError);
    const { DoRequest: ConnDoRequest } = proxyquire('../../src/lib/doRequest', {
      '@adobe/aio-lib-core-networking': {
        createFetch: function () {
          return connStub;
        },
      },
      './utils': { sleepSeconds: sinon.stub().resolves() },
    });
    const dr = new ConnDoRequest('http://example.com');
    let err;
    try {
      await dr.doGet('/', {});
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.code, 'CONNECTION_ERROR');
    assert.match(err.message, /ECONNREFUSED/);
    assert.match(err.message, /HTTPS_PROXY/);
    assert.match(err.message, /x-request-id: [0-9a-f-]{36}/i);
    // a handshake/connection failure is not worth retrying five times
    assert.equal(connStub.callCount, 1);
  });
  it('doPost', async function () {
    const body = { fake: 'body' };
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doPost('/postPath', body);
    assert.equal(reqSpy.calledOnce, true);
    const [method, path, reqBody, requestId] = reqSpy.firstCall.args;
    assert.equal(method, 'post');
    assert.equal(path, '/postPath');
    assert.deepEqual(reqBody, { fake: 'body' });
    assert.match(requestId, UUID_RE);
    const [url, options] = fetchStub.firstCall.args;
    assert.equal(url, 'http://example.com/postPath');
    assert.equal(options.method, 'post');
    assert.equal(options.body, JSON.stringify(body));
    assert.equal(options.headers['content-type'], 'application/json');
    assert.equal(options.headers['x-request-id'], requestId);
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doPut', async function () {
    const body = { fake: 'body' };
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doPut('/putPath', body);
    assert.equal(reqSpy.calledOnce, true);
    const [method, path, reqBody] = reqSpy.firstCall.args;
    assert.equal(method, 'put');
    assert.equal(path, '/putPath');
    assert.deepEqual(reqBody, body);
    const [url, options] = fetchStub.firstCall.args;
    assert.equal(url, 'http://example.com/putPath');
    assert.equal(options.method, 'put');
    assert.equal(options.body, JSON.stringify(body));
    assert.equal(options.headers['content-type'], 'application/json');
    assert.match(options.headers['x-request-id'], UUID_RE);
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doDelete', async function () {
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doDelete('/delPath');
    assert.equal(reqSpy.calledOnce, true);
    const [method, path] = reqSpy.firstCall.args;
    assert.equal(method, 'delete');
    assert.equal(path, '/delPath');
    const [url, options] = fetchStub.firstCall.args;
    assert.equal(url, 'http://example.com/delPath');
    assert.equal(options.method, 'delete');
    assert.match(options.headers['x-request-id'], UUID_RE);
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doRequest without a request id generates one', async function () {
    const dr = new DoRequest('http://example.com');
    const body = new FormData();
    body.append('foo', 'bar');
    await dr.doRequest('post', '/postPath', body);
    const [url, options] = fetchStub.firstCall.args;
    assert.equal(url, 'http://example.com/postPath');
    assert.equal(options.method, 'post');
    assert.equal(options.body, body);
    assert.match(options.headers['x-request-id'], UUID_RE);
  });
  it('doRequest preserves a caller-provided x-request-id header', async function () {
    const dr = new DoRequest('http://example.com', {
      'x-request-id': 'caller-supplied-id',
    });
    await dr.doRequest('get', '/path');
    const [, options] = fetchStub.firstCall.args;
    assert.equal(options.headers['x-request-id'], 'caller-supplied-id');
  });
  it('withRetries returns undefined on exhaustion by default', async function () {
    const closure = sinon.stub().resolves({ status: 404 });
    const result = await withRetries(closure, () => false, 0, 2);
    assert.equal(result, undefined);
    assert.equal(closure.callCount, 2);
  });
  it('withRetries returns the last result on exhaustion when requested', async function () {
    const closure = sinon.stub().resolves({ status: 404 });
    const result = await withRetries(closure, () => false, 0, 2, true);
    assert.deepEqual(result, { status: 404 });
  });
});

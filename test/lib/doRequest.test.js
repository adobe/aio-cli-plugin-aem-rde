const assert = require('node:assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const FormData = require('form-data');
const fetchStub = sinon.spy(
  sinon.stub().returns(Promise.resolve({ status: 200, response: 'ok' }))
);
const { DoRequest } = proxyquire('../../src/lib/doRequest', {
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
    assert.equal(
      fetchStub.calledWith('http://example.com/', {
        method: 'get',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      }),
      true
    );
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doPost', async function () {
    const body = { fake: 'body' };
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doPost('/postPath', body);
    assert.equal(reqSpy.calledOnce, true);
    assert.equal(
      reqSpy.calledWith('post', '/postPath', { fake: 'body' }),
      true
    );
    assert.equal(
      fetchStub.calledWith('http://example.com/postPath', {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      true
    );
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doPut', async function () {
    const body = { fake: 'body' };
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doPut('/putPath', body);
    assert.equal(reqSpy.calledOnce, true);
    assert.equal(reqSpy.calledWith('put', '/putPath', body), true);
    assert.equal(
      fetchStub.calledWith('http://example.com/putPath', {
        method: 'put',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      true
    );
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doDelete', async function () {
    const dr = new DoRequest('http://example.com');
    const reqSpy = sinon.spy(dr, 'doRequest');
    const result = await dr.doDelete('/delPath');
    assert.equal(reqSpy.calledOnce, true);
    assert.equal(reqSpy.calledWith('delete', '/delPath'), true);
    assert.equal(
      fetchStub.calledWith('http://example.com/delPath', {
        method: 'delete',
        headers: {},
      }),
      true
    );
    assert.deepEqual(result, { status: 200, response: 'ok' });
  });
  it('doRequest with form data', async function () {
    const dr = new DoRequest('http://example.com');
    const body = new FormData();
    body.append('foo', 'bar');
    await dr.doRequest('post', '/postPath', body);
    assert.equal(
      fetchStub.calledWith('http://example.com/postPath', {
        method: 'post',
        headers: {},
        body,
      }),
      true
    );
  });
});

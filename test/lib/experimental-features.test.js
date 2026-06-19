'use strict';

const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('experimental-features', function () {
  let sb;
  let fsStub;
  let inquirerStub;
  let expFeatures;

  beforeEach(function () {
    sb = sinon.createSandbox();
    fsStub = {
      existsSync: sb.stub(),
      readFileSync: sb.stub(),
      mkdirSync: sb.stub(),
      writeFileSync: sb.stub(),
    };
    inquirerStub = { prompt: sb.stub() };
    expFeatures = proxyquire('../../src/lib/experimental-features', {
      fs: fsStub,
      inquirer: inquirerStub,
    });
  });

  afterEach(() => sb.restore());

  describe('getAcceptedFeatures', function () {
    it('returns empty array when cache file does not exist', function () {
      fsStub.existsSync.returns(false);
      assert.deepStrictEqual(expFeatures.getAcceptedFeatures('/cache'), []);
    });

    it('returns accepted features from cache file', function () {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(
        JSON.stringify({ accepted: ['snapshots'], updatedAt: new Date().toISOString() })
      );
      assert.deepStrictEqual(expFeatures.getAcceptedFeatures('/cache'), ['snapshots']);
    });

    it('returns empty array when accepted field is not an array', function () {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(JSON.stringify({ accepted: 'not-an-array' }));
      assert.deepStrictEqual(expFeatures.getAcceptedFeatures('/cache'), []);
    });

    it('returns empty array when reading file throws', function () {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.throws(new Error('read error'));
      assert.deepStrictEqual(expFeatures.getAcceptedFeatures('/cache'), []);
    });
  });

  describe('saveAcceptedFeature', function () {
    it('writes a new feature to the cache file', function () {
      fsStub.existsSync.returns(false);
      expFeatures.saveAcceptedFeature('/cache', ['snapshots']);
      assert.ok(fsStub.mkdirSync.calledWith('/cache', { recursive: true }));
      assert.ok(fsStub.writeFileSync.calledOnce);
      const written = JSON.parse(fsStub.writeFileSync.firstCall.args[1]);
      assert.deepStrictEqual(written.accepted, ['snapshots']);
    });

    it('does not duplicate an already-accepted feature', function () {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(JSON.stringify({ accepted: ['snapshots'] }));
      expFeatures.saveAcceptedFeature('/cache', ['snapshots']);
      const written = JSON.parse(fsStub.writeFileSync.firstCall.args[1]);
      assert.deepStrictEqual(written.accepted, ['snapshots']);
    });

    it('appends a new feature to existing accepted list', function () {
      fsStub.existsSync.returns(true);
      fsStub.readFileSync.returns(JSON.stringify({ accepted: ['other'] }));
      expFeatures.saveAcceptedFeature('/cache', ['snapshots']);
      const written = JSON.parse(fsStub.writeFileSync.firstCall.args[1]);
      assert.deepStrictEqual(written.accepted, ['other', 'snapshots']);
    });
  });

  describe('getDisclaimerForFeature', function () {
    it('returns a non-empty string for the snapshots feature', function () {
      const disclaimer = expFeatures.getDisclaimerForFeature('snapshots');
      assert.ok(typeof disclaimer === 'string' && disclaimer.length > 0);
    });
  });

  describe('promptForFeatureAcceptance', function () {
    it('returns true when user accepts', async function () {
      inquirerStub.prompt.resolves({ accepted: true });
      assert.strictEqual(
        await expFeatures.promptForFeatureAcceptance(['snapshots']),
        true
      );
    });

    it('returns false when user rejects', async function () {
      inquirerStub.prompt.resolves({ accepted: false });
      assert.strictEqual(
        await expFeatures.promptForFeatureAcceptance(['snapshots']),
        false
      );
    });

    it('throws for an unknown feature', async function () {
      let err;
      try {
        await expFeatures.promptForFeatureAcceptance(['unknown-feature']);
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof TypeError);
    });
  });
});

'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Spinnies = require('../../src/lib/spinnies-wrapper');

describe('Spinnies wrapper', function () {
  let sandbox;
  let sp;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    sp = new Spinnies();
  });

  afterEach(() => sandbox.restore());

  describe('add', function () {
    it('delegates to the underlying spinnies instance', function () {
      const addStub = sandbox.stub(sp.spinnies, 'add');
      sp.add('s1', { text: 'working' });
      assert.ok(addStub.calledOnceWith('s1', { text: 'working' }));
    });
  });

  describe('succeed', function () {
    it('calls succeed on the underlying instance when the spinner exists', function () {
      sp.spinnies.spinners['s1'] = {};
      const succeedStub = sandbox.stub(sp.spinnies, 'succeed');
      sp.succeed('s1', { text: 'done' });
      assert.ok(succeedStub.calledOnceWith('s1', { text: 'done' }));
    });

    it('does not call succeed when the spinner does not exist', function () {
      const succeedStub = sandbox.stub(sp.spinnies, 'succeed');
      sp.succeed('nonexistent', { text: 'done' });
      assert.ok(succeedStub.notCalled);
    });
  });

  describe('stopAll', function () {
    it('delegates to the underlying spinnies instance', function () {
      const stopAllStub = sandbox.stub(sp.spinnies, 'stopAll');
      sp.stopAll('fail');
      assert.ok(stopAllStub.calledOnceWith('fail'));
    });
  });

  describe('suspendAll / resumeAll', function () {
    it('snapshots active spinners before removing them', function () {
      sp.spinnies.spinners = { s1: { text: 'first' }, s2: { text: 'second' } };
      sandbox.stub(sp.spinnies, 'remove');
      sp.suspendAll();
      assert.deepStrictEqual(sp.suspendedSpinners, {
        s1: { text: 'first' },
        s2: { text: 'second' },
      });
    });

    it('removes every active spinner on suspend', function () {
      sp.spinnies.spinners = { s1: { text: 'first' }, s2: { text: 'second' } };
      const removeStub = sandbox.stub(sp.spinnies, 'remove');
      sp.suspendAll();
      assert.ok(removeStub.calledWith('s1'));
      assert.ok(removeStub.calledWith('s2'));
    });

    it('re-adds each suspended spinner on resume', function () {
      sp.suspendedSpinners = { s1: { text: 'first' }, s2: { text: 'second' } };
      const addStub = sandbox.stub(sp.spinnies, 'add');
      sp.resumeAll();
      assert.ok(addStub.calledWith('s1', { text: 'first' }));
      assert.ok(addStub.calledWith('s2', { text: 'second' }));
    });

    it('clears suspendedSpinners to null after resume', function () {
      sp.suspendedSpinners = { s1: { text: 'hello' } };
      sandbox.stub(sp.spinnies, 'add');
      sp.resumeAll();
      assert.strictEqual(sp.suspendedSpinners, null);
    });

    it('suspendAll with no active spinners stores an empty snapshot', function () {
      sandbox.stub(sp.spinnies, 'remove');
      sp.suspendAll();
      assert.deepStrictEqual(sp.suspendedSpinners, {});
    });
  });
});

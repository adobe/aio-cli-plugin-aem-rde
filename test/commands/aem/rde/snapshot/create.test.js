const { expect } = require('chai');
const sinon = require('sinon');
const CreateSnapshot = require('../../../../../src/commands/aem/rde/snapshot/create');
const Spinnies = require('spinnies');
const assert = require('assert');

/**
 *
 * @param sinon
 * @param command
 * @param methods
 */
function createCloudSdkAPIStub(sinon, command, methods) {
  const cloudSdkApiStub = {};
  Object.keys(methods).forEach((k) => {
    cloudSdkApiStub[k] = methods[k];
  });
  sinon
    .stub(command, 'withCloudSdk')
    .callsFake(async (fn) => fn(cloudSdkApiStub));
  return [command, cloudSdkApiStub];
}

/**
 *
 * @param sinon
 * @param command
 */
function createSpinniesStub(sinon, command) {
  const spinnies = new Spinnies();
  const addSpy = sinon.spy(spinnies, 'add');
  const stopAllSpy = sinon.spy(spinnies, 'stopAll');
  const succeedSpy = sinon.spy(spinnies, 'succeed');
  sinon.stub(command, 'getSpinnies').callsFake(() => spinnies);

  return {
    addSpy,
    stopAllSpy,
    succeedSpy,
  };
}

/**
 *
 * @param sinon
 * @param command
 */
function setupLogCapturing(sinon, command) {
  const logs = [];
  sinon.stub(command, 'doLog').callsFake((msg) => logs.push(msg));
  command.log = { getCapturedLogOutput: () => logs.join('\n') };
}

describe('CreateSnapshot', function () {
  describe('#runCommand', function () {
    let command,
      cloudSdkApiStub,
      addSpinniesSpy,
      stopAllSpinniesSpy,
      succeedSpinniesSpy;

    const stubbedCreateResponse = {
      status: 200,
      json: async () => ({
        actionid: 1234123,
        success: true,
      }),
    };

    let counter = 0;
    const getSnapshotProgressResponse = {
      status: 200,
      json: async () => {
        if (counter === 0) {
          counter++;
          return {
            action: 'create-snapshot',
            progressPercentage: 20,
            snapshotName: 'snapshot-001',
          };
        } else {
          return {
            action: 'create-snapshot',
            progressPercentage: 100,
            snapshotName: 'snapshot-001',
          };
        }
      },
    };

    const getArtifactsResponse = {
      status: 200,
      json: async () => ({
        status: 'Ready',
        items: [],
      }),
    };

    const stub = (response) => sinon.stub().resolves(response);

    beforeEach(() => {
      command = new CreateSnapshot([], {}, 10);
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, command, {
        createSnapshot: stub(stubbedCreateResponse),
        getSnapshotProgress: stub(getSnapshotProgressResponse),
        getArtifacts: stub(getArtifactsResponse),
      });
      const { addSpy, stopAllSpy, succeedSpy } = createSpinniesStub(
        sinon,
        command
      );
      addSpinniesSpy = addSpy;
      stopAllSpinniesSpy = stopAllSpy;
      succeedSpinniesSpy = succeedSpy;
      setupLogCapturing(sinon, command);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns result object with status and snapshots', async function () {
      const result = await command.runCommand([], {});

      expect(result.totalseconds).to.be.a('number');
      expect(result.waitingforbackend).to.be.a('date');
      expect(result.startTime).to.be.a('date');
      expect(result.processnigsnapshotstarted).to.be.a('date');
      expect(result.processnigsnapshotended).to.be.a('date');

      assert.equal(cloudSdkApiStub.createSnapshot.calledOnce, true);
      assert.equal(cloudSdkApiStub.getSnapshotProgress.called, true);
      assert.equal(cloudSdkApiStub.getArtifacts.called, true);

      expect(addSpinniesSpy.callCount).to.equal(4);

      expect(addSpinniesSpy.getCall(0).args[0]).to.equal('spinner-requesting');
      expect(addSpinniesSpy.getCall(1).args[0]).to.equal('spinner-backend');
      expect(addSpinniesSpy.getCall(2).args[0]).to.equal('spinner-create');
      expect(addSpinniesSpy.getCall(3).args[0]).to.equal('spinner-restart');

      expect(succeedSpinniesSpy.callCount).to.equal(4);

      const verifySpinnySucceeded = (
        callIndex,
        expectedSpinnerName,
        compareObjectFn
      ) => {
        const [spinnerName, obj] = succeedSpinniesSpy.getCall(callIndex).args;
        expect(spinnerName).to.equal(expectedSpinnerName);

        assert.equal(compareObjectFn(obj), true);
      };

      verifySpinnySucceeded(
        0,
        'spinner-requesting',
        (obj) =>
          obj.text.startsWith(
            'Requested to create the snapshot successfully.'
          ) && obj.successColor === 'greenBright'
      );

      verifySpinnySucceeded(
        1,
        'spinner-backend',
        (obj) =>
          obj.text.startsWith(
            'Backend picked up the job to create the snapshot.'
          ) && obj.successColor === 'greenBright'
      );
      verifySpinnySucceeded(
        2,
        'spinner-create',
        (obj) =>
          obj.text.startsWith('Created snapshot successfully.') &&
          obj.successColor === 'greenBright'
      );
    });
  });
});

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
      progressCounter,
      cloudSdkApiStub,
      addSpinniesSpy,
      stopAllSpinniesSpy,
      succeedSpinniesSpy;

    beforeEach(function () {
      progressCounter = 0;
    });

    const stubbedCreateResponseSuccess = {
      status: 200,
      json: async () => ({
        actionid: 1234123,
        success: true,
      }),
    };

    const stubbedCreateResponseFailure = (status = 400) => ({
      status,
      json: async () => ({
        actionid: 1234123,
        success: false,
        error: 'Failed to create snapshot',
      }),
    });

    const getSnapshotProgressResponse = (percentages = [20, 100]) => {
      const result = {
        status: 200,
        json: async () => ({
          action: 'create-snapshot',
          progressPercentage: percentages[progressCounter],
          snapshotName: 'snapshot-001',
        }),
      };
      progressCounter++;
      return result;
    };

    const getArtifactsResponse = {
      status: 200,
      json: async () => ({
        status: 'Ready',
        items: [],
      }),
    };

    const stub = (response) => sinon.stub().resolves(response);
    const stubReject = (message) => sinon.stub().rejects(message);

    const prepareStubs = (cloudSdkMethods) => {
      command = new CreateSnapshot([], {}, 10);
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(
        sinon,
        command,
        cloudSdkMethods
      );
      const { addSpy, stopAllSpy, succeedSpy } = createSpinniesStub(
        sinon,
        command
      );
      addSpinniesSpy = addSpy;
      stopAllSpinniesSpy = stopAllSpy;
      succeedSpinniesSpy = succeedSpy;
      setupLogCapturing(sinon, command);
    };

    afterEach(() => {
      sinon.restore();
    });

    it('calls the appropriate api and shows success spinners if the result is good.', async function () {
      prepareStubs({
        createSnapshot: stub(stubbedCreateResponseSuccess),
        getSnapshotProgress: stub(getSnapshotProgressResponse()),
        getArtifacts: stub(getArtifactsResponse),
      });

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

    it('catches a bad progress result (-2)', async function () {
      prepareStubs({
        createSnapshot: stub(stubbedCreateResponseSuccess),
        getArtifacts: stub(getArtifactsResponse),
        getSnapshotProgress: stub(getSnapshotProgressResponse([20, -2])),
      });

      try {
        await command.runCommand([], {});
        assert.fail('Expected command to throw an error');
      } catch (err) {
        expect(err).to.be.an('error');
        expect(err.message).to.contain(
          'The snapshot failed to be created. Please contact support.'
        );
      }
    });

    it('catches a withCloudSdk exception - createSnapshot', async function () {
      prepareStubs({
        createSnapshot: stubReject('Internal error'),
      });

      try {
        await command.runCommand([], {});
        assert.fail('Expected command to throw an error');
      } catch (err) {
        expect(err).to.be.an('error');
        expect(err.message).to.contain(
          'There was an unexpected error when running a snapshot command.'
        );
      }
    });

    it('catches a withCloudSdk exception - getSnapshotProgress', async function () {
      prepareStubs({
        createSnapshot: stub(stubbedCreateResponseSuccess),
        getSnapshotProgress: stubReject('Internal error'),
      });

      try {
        await command.runCommand([], {});
        assert.fail('Expected command to throw an error');
      } catch (err) {
        expect(err).to.be.an('error');
        expect(err.message).to.contain(
          'There was an unexpected error when running a snapshot command.'
        );
      }
    });

    it('calls the appropriate api and shows failures', async function () {
      const checkError = async (statusCode, expectedMessage) => {
        prepareStubs({
          createSnapshot: stub(stubbedCreateResponseFailure(statusCode)),
          getSnapshotProgress: stub(getSnapshotProgressResponse()),
          getArtifacts: stub(getArtifactsResponse),
        });
        try {
          await command.runCommand([], {});
          assert.fail('Expected command to throw an error');
        } catch (err) {
          expect(err).to.be.an('error');
          expect(err.message).to.include(expectedMessage);
        }
        expect(stopAllSpinniesSpy.callCount).to.equal(1);
      };

      await checkError(400, 'The given environment is not an RDE');
      await checkError(404, 'The environment or program does not exist');
      await checkError(409, 'A snapshot with the given name already exists');
      await checkError(
        503,
        'The RDE is not in a state where a snapshot can be created or restored.'
      );
      await checkError(
        507,
        'Reached the maximum number or diskspace of snapshots. Remove some snapshots and try again'
      );
      await checkError(500, 'An unknown error occurred.');
    });
  });
});

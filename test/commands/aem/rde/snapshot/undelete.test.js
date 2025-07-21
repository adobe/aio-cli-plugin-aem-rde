const assert = require('assert');
const { expect } = require('chai');
const sinon = require('sinon');
const UnDeleteSnapshot = require('../../../../../src/commands/aem/rde/snapshot/undelete');
const { snapshotsResponse, snapshots } = require('./snapshots.mocks');

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
function setupLogCapturing(sinon, command) {
  const logs = [];
  sinon.stub(command, 'doLog').callsFake((msg) => logs.push(msg));
  command.log = { getCapturedLogOutput: () => logs.join('\n') };
}

describe('UnDeleteSnapshots', function () {
  describe('#run commands', function () {
    let command, cloudSdkApiStub;

    const stubbedUnDeleteResponse = (status, details) => ({
      status,
      json: async () => ({
        details,
      }),
    });

    const stubCommandResponse = (status, details) => {
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, command, {
        getSnapshots: sinon.stub().resolves(snapshotsResponse),
        undeleteSnapshot: sinon
          .stub()
          .resolves(stubbedUnDeleteResponse(status, details)),
      });
    };

    beforeEach(() => {
      command = new UnDeleteSnapshot([], {});
      sinon.stub(command, 'spinnerStart');
      sinon.stub(command, 'spinnerStop');
      setupLogCapturing(sinon, command);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls undeleteSnapshots successfully', async () => {
      stubCommandResponse(200);

      await command.runCommand(
        {
          name: 'snap1',
        },
        {
          force: false,
        }
      );
      expect(cloudSdkApiStub.undeleteSnapshot.calledOnce).to.be.true;
      const output = command.log.getCapturedLogOutput();
      expect(output).to.include('Snapshot snap1 undeleted successfully.');

      expect(command.spinnerStart.calledOnce).to.be.true;
      expect(command.spinnerStop.calledOnce).to.be.true;
      expect(cloudSdkApiStub.undeleteSnapshot.calledWith('snap1')).to.be.true;
    });

    const executeWithErrorExpected = async (
      snapshotName,
      force,
      status,
      statusMessage,
      expectedMessage
    ) => {
      const isSingle = snapshotName && snapshotName !== 'all';
      stubCommandResponse(status, statusMessage);
      try {
        const args = {};
        const flags = {
          force,
        };
        if (isSingle) {
          args.name = snapshotName;
        } else {
          flags.all = true;
        }
        await command.runCommand(args, flags);
        assert.fail('Expected an error to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.include(expectedMessage);
      }

      if (isSingle) {
        assert.equal(cloudSdkApiStub.undeleteSnapshot.callCount, 1);
      } else {
        assert.equal(
          cloudSdkApiStub.undeleteSnapshot.callCount,
          snapshots.length
        );
      }

      const output = command.log.getCapturedLogOutput();
      expect(command.spinnerStart.called).to.be.true;
      expect(command.spinnerStop.called).to.be.true;
      if (isSingle) {
        expect(cloudSdkApiStub.undeleteSnapshot.calledWith('snap1')).to.be.true;
      } else {
        for (const snapshot of snapshots) {
          expect(cloudSdkApiStub.undeleteSnapshot.calledWith(snapshot.name)).to
            .be.true;
        }
      }
    };

    describe('single snapshot deletion', function () {
      it('reacts to error code 404 appropriately - 1', async () =>
        executeWithErrorExpected(
          'snap1',
          false,
          404,
          'The requested environment or program does not exist.',
          'The environment or program does not exist'
        ));

      it('reacts to error code 404  appropriately - 2', async () =>
        executeWithErrorExpected(
          'snap1',
          false,
          404,
          'The requested snapshot does not exist.',
          'The snapshot does not exist'
        ));

      it('reacts to error code 400 appropriately', async () =>
        executeWithErrorExpected(
          'snap1',
          false,
          400,
          null,
          'The given environment is not an RDE'
        ));

      it('reacts to error code 451 appropriately', async () =>
        executeWithErrorExpected(
          'snap1',
          false,
          451,
          null,
          'The feature is part of the EAP program and not available for general use.'
        ));

      it('reacts to error code 507 appropriately', async () =>
          executeWithErrorExpected(
              'snap1',
              false,
              507,
              null,
              'Reached the maximum number or diskspace of snapshots.'
          ));

      it('reacts to error code 500 appropriately', async () =>
          executeWithErrorExpected(
              'snap1',
              false,
              500,
              null,
              'An unknown error occurred.'
          ));
    });
  });
});

const { expect } = require('chai');
const sinon = require('sinon');
const ListSnapshots = require('../../../../../src/commands/aem/rde/snapshot');
const internalErrors = require('../../../../../src/lib/internal-errors');
const configErrors = require('../../../../../src/lib/configuration-errors');
const errorHelpers = require('../../../../../src/lib/error-helpers');

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

describe('ListSnapshots', function () {
  describe('#runCommand', function () {
    let command, cloudSdkApiStub;

    const stubbedSnapshotsResponse = {
      status: 200,
      json: async () => [
        {
          name: 'snap1',
          description: 'desc1',
          usage: 1,
          size: { total_size: 1048576 },
          state: 'AVAILABLE',
          created: '2024-06-01T12:00:00Z',
          lastUsed: '2024-06-02T12:00:00Z',
        },
        {
          name: 'snap2',
          description: 'desc2',
          usage: 2,
          size: { total_size: 1073741824 },
          state: 'DELETED',
          created: '2024-06-03T12:00:00Z',
          lastUsed: '2024-06-04T12:00:00Z',
        },
        {
          name: 'snap3',
          description: 'desc3',
          usage: 2,
          size: { total_size: 5012 },
          state: 'AVAILABLE',
          created: '2024-06-03T12:00:00Z',
          lastUsed: '2024-06-04T12:00:00Z',
        },
      ],
    };

    const stubbedEmptySnapshotsResponse = {
      status: 200,
      json: async () => [],
    };

    beforeEach(() => {
      command = new ListSnapshots([], {});
      [command, cloudSdkApiStub] = createCloudSdkAPIStub(sinon, command, {
        getSnapshots: sinon.stub().resolves(stubbedSnapshotsResponse),
      });
      sinon.stub(command, 'spinnerStart');
      sinon.stub(command, 'spinnerStop');
      setupLogCapturing(sinon, command);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls getSnapshots and logs table output for non-empty items', async function () {
      await command.runCommand([], {});
      expect(cloudSdkApiStub.getSnapshots.calledOnce).to.be.true;
      const output = command.log.getCapturedLogOutput();
      expect(output).to.include('snap1');
      expect(output).to.include('snap2');
      expect(output).to.include('snap3');
      expect(output).to.include('1.00 MB');
      expect(output).to.include('1.00 GB');
      expect(output).to.include('4.89 KB');
    });

    it('logs "There are no snapshots yet." for empty items', async function () {
      cloudSdkApiStub.getSnapshots.resolves(stubbedEmptySnapshotsResponse);
      await command.runCommand([], {});
      expect(command.log.getCapturedLogOutput()).to.include(
        'There are no snapshots yet.'
      );
    });

    it('throws DIFFERENT_ENV_TYPE error for 400 status', async function () {
      cloudSdkApiStub.getSnapshots.resolves({ status: 400 });
      try {
        await command.runCommand([], {});
        expect.fail('Should throw DIFFERENT_ENV_TYPE');
      } catch (e) {
        expect(e).to.be.instanceOf(configErrors.codes.DIFFERENT_ENV_TYPE);
      }
    });

    it('throws PROGRAM_OR_ENVIRONMENT_NOT_FOUND error for 404 status', async function () {
      cloudSdkApiStub.getSnapshots.resolves({ status: 404 });
      try {
        await command.runCommand([], {});
        expect.fail('Should throw PROGRAM_OR_ENVIRONMENT_NOT_FOUND');
      } catch (e) {
        expect(e).to.be.instanceOf(
          configErrors.codes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND
        );
      }
    });

    it('throws UNKNOWN error for unexpected status', async function () {
      cloudSdkApiStub.getSnapshots.resolves({ status: 500 });
      try {
        await command.runCommand([], {});
        expect.fail('Should throw UNKNOWN');
      } catch (e) {
        expect(e).to.be.instanceOf(internalErrors.codes.UNKNOWN);
      }
    });

    it('throws INTERNAL_SNAPSHOT_ERROR if getSnapshots throws', async function () {
      cloudSdkApiStub.getSnapshots.rejects(new Error('fail'));
      sinon.stub(errorHelpers, 'throwAioError').throws(
        new internalErrors.codes.INTERNAL_SNAPSHOT_ERROR({
          messageValues: 'fail',
        })
      );
      try {
        await command.runCommand([], {});
        expect.fail('Should throw INTERNAL_SNAPSHOT_ERROR');
      } catch (e) {
        expect(e).to.be.instanceOf(
          internalErrors.codes.INTERNAL_SNAPSHOT_ERROR
        );
      }
    });

    it('returns result object with status and snapshots', async function () {
      const result = await command.runCommand([], {});
      expect(result.status).to.equal(200);
      expect(result.snapshots).to.exist;
      expect(result.snapshots).to.be.an('array');
    });
  });
});

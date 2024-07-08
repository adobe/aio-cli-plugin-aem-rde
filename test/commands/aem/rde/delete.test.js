const sinon = require('sinon');
const assert = require('assert');
const DeleteCommand = require('../../../../src/commands/aem/rde/delete.js');

describe('DeleteCommand', function () {
  let command, cloudSdkApiStub;

  beforeEach(() => {
    command = new DeleteCommand();
    cloudSdkApiStub = sinon.stub(command, 'withCloudSdk');
    sinon.stub(command, 'spinnerStart');
    sinon.stub(command, 'spinnerStop');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('successfully deletes artifacts', async function () {
    cloudSdkApiStub.onFirstCall().resolves({
      items: [
        {
          id: 'test-bundle',
          updateId: '1',
          service: 'author',
          type: 'osgi-bundle',
          metadata: {
            name: 'test-bundle',
            bundleSymbolicName: 'test-bundle',
            bundleName: 'test-bundle',
            bundleVersion: '1.0.0.SNAPSHOT',
          },
        },
        {
          id: 'test-bundle',
          updateId: '1',
          service: 'publish',
          type: 'osgi-bundle',
          metadata: {
            name: 'test-bundle',
            bundleSymbolicName: 'test-bundle',
            bundleName: 'test-bundle',
            bundleVersion: '1.0.0.SNAPSHOT',
          },
        },
      ],
    });
    cloudSdkApiStub.onSecondCall().resolves({ updateId: 2 });
    cloudSdkApiStub.onThirdCall().resolves({ undefined });
    const result = await command.runCommand({ id: 'test-bundle' }, {});
    assert.deepEqual(result.items, [{ updateId: 2 }, undefined]);
  });

  it('deletes artifacts with filters', async function () {
    // Simulate different scenarios for target and type flags
    // This test should be expanded based on specific scenarios
  });

  it('handles no matching artifacts', async function () {
    cloudSdkApiStub.resolves({ items: [] });

    await assert.rejects(async () => {
      await command.runCommand({ id: 'non-existent' }, {});
    }, /DELETE_NOT_FOUND/);
  });

  it('handles errors during deletion', async function () {
    cloudSdkApiStub.rejects(new Error('Deletion failed'));

    await assert.rejects(async () => {
      await command.runCommand({ id: 'test-bundle' }, {});
    }, /Deletion failed/);
  });
});

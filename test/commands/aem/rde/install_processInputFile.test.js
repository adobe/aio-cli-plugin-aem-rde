const sinon = require('sinon');
const assert = require('assert');
const fs = require('fs');
const proxyquire = require('proxyquire');
const frontendInputBuildStub = sinon.stub();
const dispatcherInputBuildStub = sinon.stub();
const DeployCommand = proxyquire(
  '../../../../src/commands/aem/rde/install.js',
  {
    '../../../lib/frontend': {
      frontendInputBuild: frontendInputBuildStub,
    },
    '../../../lib/dispatcher': {
      dispatcherInputBuild: dispatcherInputBuildStub,
    },
  }
);

describe('DeployCommand', function () {
  let deployCommand;
  let fsStub;

  beforeEach(function () {
    deployCommand = new DeployCommand();
    fsStub = sinon.stub(fs, 'lstatSync');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should not perform action for local file', async function () {
    fsStub.returns({
      isDirectory: () => false,
    });
    await deployCommand.processInputFile(
      true,
      'irrelevant',
      '/irrelevant/path'
    );
    // No specific assertion needed, success is no error thrown
  });

  it('should call frontendInputBuild for directory with "frontend" type', async function () {
    fsStub.returns({ isDirectory: () => true });
    await deployCommand.processInputFile(true, 'frontend', '/path/to/frontend');
    assert(frontendInputBuildStub.calledOnce);
  });

  it('should call dispatcherInputBuild for directory with "dispatcher-config" type', async function () {
    fsStub.returns({ isDirectory: () => true });
    await deployCommand.processInputFile(
      true,
      'dispatcher-config',
      '/path/to/dispatcher'
    );
    assert(dispatcherInputBuildStub.calledOnce);
  });

  it('should throw error for directory with unsupported type', async function () {
    fsStub.returns({ isDirectory: () => true });
    await assert.rejects(
      async () => {
        await deployCommand.processInputFile(
          true,
          'unsupported',
          '/path/to/dir'
        );
      },
      Error,
      'A directory was specified for an unsupported type.'
    );
  });

  it('should not perform action for local file with supported types', async function () {
    fsStub.returns({ isDirectory: () => false });
    await deployCommand.processInputFile(true, 'frontend', '/path/to/file');
    await deployCommand.processInputFile(
      true,
      'dispatcher-config',
      '/path/to/file'
    );
    // No specific assertion needed, success is no error thrown
  });
});

const sinon = require('sinon');
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

describe('uploadAndDeploy', function () {
  let deployCommandInstance;
  let mockCloudSdkAPI;
  let progressBar;
  let flags;

  beforeEach(function () {
    deployCommandInstance = new DeployCommand();
    mockCloudSdkAPI = {
      deployFile: sinon.stub(),
      deployURL: sinon.stub(),
    };
    progressBar = {
      update: sinon.spy(),
      stop: sinon.spy(),
      start: sinon.spy(),
    };
    flags = { json: false, quiet: false };
    sinon.stub(deployCommandInstance, 'doLog');
    sinon.stub(deployCommandInstance, 'spinnerStart');
    sinon.stub(deployCommandInstance, 'spinnerStop');
    sinon.stub(deployCommandInstance, 'spinnerIsSpinning').returns(false);
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should call deployFile with correct arguments for local files', async function () {
    const isLocalFile = true;
    const type = 'content-package';
    const inputPath = 'path/to/file.zip';
    const effectiveUrl = '';
    const fileName = 'file.zip';
    const inputPathSize = 1024;
    const fileSize = null;
    await deployCommandInstance.uploadAndDeploy(
      flags,
      progressBar,
      isLocalFile,
      mockCloudSdkAPI,
      inputPathSize,
      fileSize,
      inputPath,
      effectiveUrl,
      fileName,
      type
    );
    sinon.assert.calledWith(
      mockCloudSdkAPI.deployFile,
      1024,
      'path/to/file.zip',
      'file.zip',
      'content-package',
      flags.target,
      flags.path,
      flags.force,
      sinon.match.object,
      sinon.match.func
    );
  });

  it('should call deployURL with correct arguments for remote files', async function () {
    const isLocalFile = false;
    const type = 'content-package';
    const inputPath = '';
    const effectiveUrl = new URL('http://example.com/file.zip');
    const fileName = 'file.zip';
    const inputPathSize = null;
    const fileSize = 2048;
    await deployCommandInstance.uploadAndDeploy(
      flags,
      progressBar,
      isLocalFile,
      mockCloudSdkAPI,
      inputPathSize,
      fileSize,
      inputPath,
      effectiveUrl,
      fileName,
      type
    );
    sinon.assert.calledWith(
      mockCloudSdkAPI.deployURL,
      2048,
      'http://example.com/file.zip',
      'file.zip',
      'content-package',
      flags.target,
      flags.path,
      flags.force,
      sinon.match.object,
      sinon.match.func
    );
  });
});

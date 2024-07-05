const sinon = require('sinon');
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

describe('doDeployment', function () {
  let deployCommandInstance;
  let mockCloudSdkAPI;
  let progressBar;
  let flags;
  let isLocalFile,
    inputPathSize,
    fileSize,
    inputPath,
    effectiveUrl,
    fileName,
    type,
    result;
  let loadUpdateHistory;

  beforeEach(function () {
    deployCommandInstance = new DeployCommand();
    loadUpdateHistory = sinon.spy();
    mockCloudSdkAPI = {
      deployFile: sinon.stub(),
      deployURL: sinon.stub(),
      getChange: sinon.stub(),
    };
    progressBar = {
      update: sinon.spy(),
      stop: sinon.spy(),
      start: sinon.spy(),
    };
    flags = {
      json: false,
      quiet: false,
      target: 'target',
      path: 'path',
      force: false,
    };
    isLocalFile = true;
    inputPathSize = 1024;
    fileSize = 2048;
    inputPath = 'path/to/file.zip';
    effectiveUrl = new URL('http://example.com/file.zip');
    fileName = 'file.zip';
    type = 'content-package';
    result = { items: [] };

    sinon
      .stub(deployCommandInstance, 'withCloudSdk')
      .callsFake((fn) => fn(mockCloudSdkAPI));
    sinon.stub(deployCommandInstance, 'spinnerStop');
    sinon.stub(deployCommandInstance, 'spinnerStart');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should handle errors thrown by withCloudSdk', async function () {
    deployCommandInstance.withCloudSdk.rejects(new Error('Test Error'));
    await deployCommandInstance
      .doDeployment(
        null,
        flags,
        progressBar,
        isLocalFile,
        inputPathSize,
        fileSize,
        inputPath,
        effectiveUrl,
        fileName,
        type,
        result
      )
      .catch((e) => {
        sinon.assert.match(e.message, 'Test Error');
      });
  });
});

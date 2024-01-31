const { CloudSdkAPI } = require('../src/lib/cloud-sdk-api');

/**
 * @param sinon
 * @param cli
 */
function setupLogCapturing(sinon, cli) {
  before(() => {
    sinon.replace(cli, 'log', sinon.fake());
    cli.log.getCapturedLogOutput = () =>
      cli.log
        .getCalls()
        .map((i) => i.firstArg)
        .join('\n');
  });

  // Resets the internal state of all fakes created through sandbox, see https://sinonjs.org/releases/latest/sandbox/#sandboxreset
  beforeEach(sinon.reset);

  // Restores all fakes created through sandbox, see https://sinonjs.org/releases/latest/sandbox/#sandboxrestore
  after(sinon.restore);
}

/**
 * @param sinon
 * @param command
 * @param stubbedMethods
 */
function createCloudSdkAPIStub(sinon, command, stubbedMethods) {
  const cloudSdkApiStub = sinon.createStubInstance(CloudSdkAPI);
  if (stubbedMethods) {
    Object.keys(stubbedMethods).forEach((methodName) =>
      sinon.replace(
        cloudSdkApiStub,
        methodName,
        sinon.fake(stubbedMethods[methodName])
      )
    );
  }
  flags : {
    ['--programId',1111,'environmentId',22222]
  };

  sinon.replace(command,'getProgramId', (flags) =>  {return '12345'});
  sinon.replace(command,'getEnvironmentId',  (flags) =>  {return '54321'});
  sinon.replace(command, 'withCloudSdk', (flags, fn) => fn(cloudSdkApiStub));
  return [command, cloudSdkApiStub];
}

module.exports = {
  setupLogCapturing,
  createCloudSdkAPIStub,
};

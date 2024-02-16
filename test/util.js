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
  afterEach(() => sinon.reset());

  // Restores all fakes created through sandbox, see https://sinonjs.org/releases/latest/sandbox/#sandboxrestore
  after(() => sinon.restore());
}

/**
 * @param sinon
 * @param command
 * @param stubbedMethods
 */
function createCloudSdkAPIStub(sinon, command, stubbedMethods) {
  const cloudSdkApiStub = sinon.createStubInstance(CloudSdkAPI);
  if (stubbedMethods) {
    Object.keys(stubbedMethods).forEach((methodName) => {
      const methodOrObject = stubbedMethods[methodName];
      if (typeof methodOrObject === 'function') {
        return cloudSdkApiStub[methodName].callsFake(methodOrObject);
      } else {
        return cloudSdkApiStub[methodName].returns(methodOrObject);
      }
    });
  }

  sinon.replace(command, 'withCloudSdk', (fn) => fn(cloudSdkApiStub));
  return [command, cloudSdkApiStub];
}

module.exports = {
  setupLogCapturing,
  createCloudSdkAPIStub,
};

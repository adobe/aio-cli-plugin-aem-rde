const { CloudSdkAPI } = require('../src/lib/cloud-sdk-api');

/**
 * @param sinon
 * @param cli
 * @param command
 */
function setupLogCapturing(sinon, command) {
  sinon.replace(command, 'log', sinon.fake());
  command.log.getCapturedLogOutput = () =>
    command.log
      .getCalls()
      .map((i) => i.firstArg)
      .join('\n');

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

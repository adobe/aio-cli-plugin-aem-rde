const {CloudSdkAPI} = require("../../../../src/lib/cloud-sdk-api");

function setupLogCapturing(sinon, cli) {
    before(() => {
        sinon.replace(cli, 'log', sinon.fake());
        cli.log.getCapturedLogOutput = () => cli.log.getCalls().map(i => i.firstArg).join('\n')
    });

    // Resets the internal state of all fakes created through sandbox, see https://sinonjs.org/releases/latest/sandbox/#sandboxreset
    beforeEach(sinon.reset);

    // Restores all fakes created through sandbox, see https://sinonjs.org/releases/latest/sandbox/#sandboxrestore
    after(sinon.restore);
}

function createCloudSdkAPIStub(sinon, command, stubbedMethods) {
    let cloudSdkApiStub = sinon.createStubInstance(CloudSdkAPI);
    Object.keys(stubbedMethods).forEach(methodName =>
        sinon.replace(cloudSdkApiStub, methodName, sinon.fake(stubbedMethods[methodName]))
    );

    sinon.replace(command, 'withCloudSdk', fn => fn(cloudSdkApiStub));
    return [command, cloudSdkApiStub];
}

module.exports = {
    setupLogCapturing,
    createCloudSdkAPIStub
}

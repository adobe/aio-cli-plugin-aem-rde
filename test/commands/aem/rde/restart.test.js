const assert = require('assert');
const RestartCmd = require('../../../../src/commands/aem/rde/restart.js');

const mockCloudSDKAPI = {}
mockCloudSDKAPI.restartEnvCalled = false;
mockCloudSDKAPI.restartEnv = function() {
    this.restartEnvCalled = true;
}

const mockWithCloudSdk = function(fn) {
    return fn(mockCloudSDKAPI);
}

describe('RestartCmd', function() {
    describe('#run', async function() {
        const rc = new RestartCmd();
        rc.withCloudSdk = mockWithCloudSdk.bind(rc);
        rc.run();

        it('cloudSDKAPI.restartEnv() has been called', function() {
            assert.ok(mockCloudSDKAPI.restartEnvCalled);
        });
    });
});
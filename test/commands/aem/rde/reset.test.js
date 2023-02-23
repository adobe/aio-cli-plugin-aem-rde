const assert = require('assert');
const ResetCmd = require('../../../../src/commands/aem/rde/reset.js');

const mockCloudSDKAPI = {}
mockCloudSDKAPI.resetEnvCalled = false;
mockCloudSDKAPI.resetEnv = function() {
    console.log("Resetenv called");
    this.resetEnvCalled = true;
}

const mockWithCloudSdk = function(fn) {
    fn(mockCloudSDKAPI);
}

describe('ResetCmd', function() {
    describe('#run', async function() {
        console.log("Trying");
        const rc = new ResetCmd();
        rc.withCloudSdk = mockWithCloudSdk.bind(rc);

        rc.run();
        console.log("Done");
        it('cloudSDKAPI.resetEnv() should have been called', function() {
            assert.ok(mockCloudSDKAPI.resetEnvCalled);
        });
    });
});
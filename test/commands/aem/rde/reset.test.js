const assert = require('assert');
const ResetCmd = require('../../../../src/commands/aem/rde/reset.js');

const mockCloudSDKAPI = {}
mockCloudSDKAPI.resetEnvCalled = false;
mockCloudSDKAPI.resetEnv = function() {
    this.resetEnvCalled = true;
}

const mockWithCloudSdk = function(fn) {
    return fn(mockCloudSDKAPI);
}

describe('ResetCmd', function() {
    describe('#run', async function() {
        const rc = new ResetCmd();
        rc.withCloudSdk = mockWithCloudSdk.bind(rc);

        rc.run();
        it('cloudSDKAPI.resetEnv() has been called', function() {
            assert.ok(mockCloudSDKAPI.resetEnvCalled);
        });
    });
});
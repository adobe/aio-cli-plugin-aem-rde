const assert = require('assert');
const ResetCmd = require('../../../../src/commands/aem/rde/reset.js');

const mockWithCloudSdk = function(obj) {
    console.log(JSON.stringify(obj));
}

describe('ResetCmd', function() {
    describe('#run', async function() {
        console.log("Trying");
        const rc = new ResetCmd();
        rc.withCloudSdk = mockWithCloudSdk;

        // rc.withCloudSdk((cloudSdkAPI) => cloudSdkAPI.resetEnv());

        await rc.run();
        console.log("Done");
        it('test', function() {
            assert.equal(1,1);
            assert.fail("Write this test");
        });
    });
});


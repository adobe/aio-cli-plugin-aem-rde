const assert = require('assert');
const StatusCmd = require('../../../../src/commands/aem/rde/status.js');

const mockCloudSDKAPI = {};
mockCloudSDKAPI.called = [];
mockCloudSDKAPI.getArtifacts = function(cursor) {
    this.called.push("getArtifacts");

    const result = {};
    result.status = 200;
    result.json = function() {
        const jsres = {};
        jsres.status = "OK";
        jsres.items = ["a", "b", "c"];
        return jsres;
    };
    return result;
}

const mockWithCloudSdk = function(fn) {
    return fn(mockCloudSDKAPI);
}

describe('StatusCmd', function() {
    describe('#run', async function() {
        const sc = new StatusCmd();
        sc.withCloudSdk = mockWithCloudSdk.bind(sc);

        sc.run();
        it('getArtifacts() has been called once', function() {
            assert.equal(1, mockCloudSDKAPI.called.length);
            assert.equal("getArtifacts", mockCloudSDKAPI.called[0]);
        });
    });
});
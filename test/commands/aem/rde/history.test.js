const assert = require('assert');
const sinon = require('sinon');

const { cli } = require('../../../../src/lib/base-command');
const ChangesCommand = require('../../../../src/commands/aem/rde/history.js');

const mockCloudSDKAPI = {}
mockCloudSDKAPI.called = [];
mockCloudSDKAPI.getChange = function(id) {
    this.called.push("getChange " + id);
    const res = {};
    res.status = 200;
    res.headers = new Map();
    res.json = function() {
        const jsobj = {
            updateId: 123,
            action: "install",
            status: 'OK',
            metadata: {},
            timestamps: {}
        };
        return jsobj;
    };
    return res;
}
mockCloudSDKAPI.getLogs = function(id) {
    this.called.push("getLogs " + id);
    const res = {};
    res.status = 200;
    res.text = function() {
        return "logline";
    };
    return res;
}

const mockWithCloudSdk = function(fn) {
    return fn(mockCloudSDKAPI);
}

let mockCliLines = "";

describe('ChangesCommand', function() {
    describe("#run", async function() {
        sinon.stub(cli, "log").callsFake(function(v) {
            mockCliLines += v + '\n';
        });

        const cc = new ChangesCommand();
        cc.argv = ["123"];
        cc.withCloudSdk = mockWithCloudSdk.bind(cc);

        cc.run();

        it('called the right remote API methods', function() {
            assert.ok(mockCliLines.includes("123"));
            assert.ok(mockCliLines.includes("logline"));

            assert.equal(2, mockCloudSDKAPI.called.length);
            assert.equal("getChange 123", mockCloudSDKAPI.called[0]);
            assert.equal("getLogs 123", mockCloudSDKAPI.called[1]);
        });
    });
})
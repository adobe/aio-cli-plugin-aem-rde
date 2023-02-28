const assert = require('assert');
const sinon = require('sinon');

const { cli } = require('../../../../src/lib/base-command');
const ChangesCommand = require('../../../../src/commands/aem/rde/history.js');

describe('ChangesCommand', function() {
    describe('#run', function() {
        let mockCliLines = "";

        let logStub;
        before(function() {
            logStub = sinon.stub(cli, "log");
            logStub.callsFake(function(v) {
                mockCliLines += v + '\n';
            });
        });
        after(function() {
            logStub.restore();
        });

        it('The correct changes are reported', async function() {
            // This is all mock setup for the test
            const mockCloudSDKAPI = {}
            mockCloudSDKAPI.getChangesCalled = false;
            mockCloudSDKAPI.getChanges = function() {
                this.getChangesCalled = true;
                const res = {};
                res.status = 200;
                res.json = function() {
                    const jsres = {};
                    jsres.items = [{
                        updateId: 6,
                        action: "install",
                        status: 'OK',
                        metadata: {},
                        timestamps: {}
                    },{
                        updateId: 8,
                        action: "delete",
                        status: 'OK',
                        metadata: {},
                        timestamps: {}
                    }];
                    return jsres;
                }
                return res;
            };

            const mockWithCloudSdk = function(fn) {
                return fn(mockCloudSDKAPI);
            };


            // The real test starts here
            const cc1 = new ChangesCommand();
            cc1.withCloudSdk = mockWithCloudSdk.bind(cc1);
            cc1.argv = [];

            await cc1.run();

            assert.ok(mockCloudSDKAPI.getChangesCalled);
            assert.ok(mockCliLines.includes("#6: install OK"));
            assert.ok(mockCliLines.includes("#8: delete OK"));
        });
    });
});

describe('ChangesCommand2', function() {
    describe("#run with id", function() {
        let mockCliLines = "";

        let logStub;
        before(function () {
            logStub = sinon.stub(cli, "log");
            logStub.callsFake(function(v) {
                mockCliLines += v + '\n';
            });
        });
        after(function() {
            logStub.restore();
        });

        it('called the right remote API methods', async function() {
            // This is all mock setup for the test
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
            };

            const mockWithCloudSdk = function(fn) {
                return fn(mockCloudSDKAPI);
            };

            // Test starts here
            const cc = new ChangesCommand();
            cc.argv = ["123"];
            cc.withCloudSdk = mockWithCloudSdk.bind(cc);

            await cc.run();

            assert.ok(mockCliLines.includes("123"));
            assert.ok(mockCliLines.includes("logline"));

            assert.equal(2, mockCloudSDKAPI.called.length);
            assert.equal("getChange 123", mockCloudSDKAPI.called[0]);
            assert.equal("getLogs 123", mockCloudSDKAPI.called[1]);
        });
    });
});

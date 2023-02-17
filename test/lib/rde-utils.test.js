const assert = require('assert');
const RdeUtils = require('../../src/lib/rde-utils.js');

describe('RdeUtils', function () {
  describe('#groupArtifacts', function () {
    const arts = [{
      "id": "test.bundle.auth",
      "updateId": "6",
      "service": "author",
      "type": "osgi-bundle"
    }, {
      "id": "test.config.pblsh",
      "updateId": "6",
      "service": "publish",
      "type": "osgi-config"
    }, {
      "id": "test.config.auth",
      "updateId": "6",
      "service": "author",
      "type": "osgi-config"
    }];
    const grouped = RdeUtils.groupArtifacts(arts);

    it('author has 1 bundle and 1 config', function () {
      assert.equal(1, grouped.author['osgi-bundle'].length);
      assert.equal("test.bundle.auth", grouped.author['osgi-bundle'][0].id);
      assert.equal(1, grouped.author['osgi-config'].length);
      assert.equal("test.config.auth", grouped.author['osgi-config'][0].id);
    })

    it('publish has only 1 config', function () {
      assert.equal(0, grouped.publish['osgi-bundle'].length);
      assert.equal(1, grouped.publish['osgi-config'].length);
      assert.equal("test.config.pblsh", grouped.publish['osgi-config'][0].id);
      assert.equal("6", grouped.publish['osgi-config'][0].updateId);
      assert.equal("publish", grouped.publish['osgi-config'][0].service);
      assert.equal("osgi-config", grouped.publish['osgi-config'][0].type);
    });
  });
});

const assert = require('assert');
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

describe('DeployCommand.guessPath', function () {
  let deployCommand;
  let flags;
  before(function () {
    deployCommand = new DeployCommand([]);
  });

  describe('.getPath', function () {
    beforeEach(function () {
      flags = {};
    });

    it('should update flags.path for content-file type with valid inputPath', function () {
      deployCommand.getPath(
        'content-file',
        flags,
        true,
        '/some/path/jcr_root/content/myproject'
      );
      assert.equal(flags.path, 'content/myproject');
    });

    it('should update flags.path for content-xml type with valid inputPath', function () {
      deployCommand.getPath(
        'content-xml',
        flags,
        true,
        '/some/path/jcr_root/content/myproject/content.xml'
      );
      assert.equal(flags.path, 'content/myproject/content');
    });

    it('should not update flags.path for non-content file types', function () {
      deployCommand.getPath(
        'osgi-bundle',
        flags,
        true,
        '/some/path/jcr_root/content/myproject'
      );
      assert.equal(flags.path, undefined);
    });

    it('should not update flags.path for content-file type without jcr_root in path', function () {
      deployCommand.getPath(
        'content-file',
        flags,
        true,
        '/some/path/content/myproject'
      );
      assert.equal(flags.path, undefined);
    });

    it('should not update flags.path if already set', function () {
      flags.path = 'already/set/path';
      deployCommand.getPath(
        'content-file',
        flags,
        true,
        '/some/path/jcr_root/content/myproject'
      );
      assert.equal(flags.path, 'already/set/path');
    });
  });
});

const assert = require('assert');
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

describe('DeployCommand.guessPath', function () {
  let deployCommand;
  before(function () {
    deployCommand = new DeployCommand();
  });

  describe('guessPath', function () {
    it('should return correct subpath for .content.xml file', function () {
      const inputPath = '/some/path/jcr_root/content/site/.content.xml';
      const expected = 'content/site';
      assert.equal(deployCommand.guessPath(inputPath), expected);
    });

    it('should return correct subpath for .xml file', function () {
      const inputPath = '/some/path/jcr_root/content/site/nodes.xml';
      const expected = 'content/site/nodes';
      assert.equal(deployCommand.guessPath(inputPath), expected);
    });

    it('should return correct subpath for non-.xml file', function () {
      const inputPath = '/some/path/jcr_root/content/site/image.jpg';
      const expected = 'content/site/image.jpg';
      assert.equal(deployCommand.guessPath(inputPath), expected);
    });

    it('should return undefined for path without jcr_root', function () {
      const inputPath = '/some/path/content/site/content.xml';
      assert.equal(deployCommand.guessPath(inputPath), undefined);
    });

    it('should return correct subpath for path without file extension', function () {
      const inputPath = '/some/path/jcr_root/content/site/folder';
      const expected = 'content/site/folder';
      assert.equal(deployCommand.guessPath(inputPath), expected);
    });

    it('should return correct subpath for nested jcr_root folders', function () {
      const inputPath =
        '/some/path/jcr_root/another/jcr_root/content/site/.content.xml';
      const expected = 'content/site';
      assert.equal(deployCommand.guessPath(inputPath), expected);
    });
  });
});

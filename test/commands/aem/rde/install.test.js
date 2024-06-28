const assert = require('assert');
const rewire = require('rewire');

const testee = rewire('../../../../src/commands/aem/rde/install');

let guessPath; // Declare variable to hold the function

before(function () {
  // Access guessPath using rewire's __get__ method
  guessPath = testee.__get__('guessPath');
});

describe('guessPath', function () {
  it('should return correct subpath for .content.xml file', function () {
    const inputPath = '/some/path/jcr_root/content/site/.content.xml';
    const expected = 'content/site';
    assert.equal(guessPath(inputPath), expected);
  });

  it('should return correct subpath for .xml file', function () {
    const inputPath = '/some/path/jcr_root/content/site/nodes.xml';
    const expected = 'content/site/nodes';
    assert.equal(guessPath(inputPath), expected);
  });

  it('should return correct subpath for non-.xml file', function () {
    const inputPath = '/some/path/jcr_root/content/site/image.jpg';
    const expected = 'content/site/image.jpg';
    assert.equal(guessPath(inputPath), expected);
  });

  it('should return undefined for path without jcr_root', function () {
    const inputPath = '/some/path/content/site/content.xml';
    assert.equal(guessPath(inputPath), undefined);
  });

  it('should return correct subpath for path without file extension', function () {
    const inputPath = '/some/path/jcr_root/content/site/folder';
    const expected = 'content/site/folder';
    assert.equal(guessPath(inputPath), expected);
  });

  it('should return correct subpath for nested jcr_root folders', function () {
    const inputPath =
      '/some/path/jcr_root/another/jcr_root/content/site/.content.xml';
    const expected = 'content/site';
    assert.equal(guessPath(inputPath), expected);
  });
});

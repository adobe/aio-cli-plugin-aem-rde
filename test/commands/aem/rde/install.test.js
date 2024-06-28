const assert = require('assert');
const rewire = require('rewire');

const testee = rewire('../../../../src/commands/aem/rde/install');

let guessPath; // Declare variable to hold the function
let guessType; // Declare variable to hold the function

before(function () {
  guessPath = testee.__get__('guessPath');
  guessType = testee.__get__('guessType');
});

describe('guessType', function () {
  it('should return osgi-bundle for .jar files', function () {
    const result = guessType('example.jar');
    assert.deepEqual(result, ['osgi-bundle']);
  });

  it('should return osgi-config for .json files', function () {
    const result = guessType('config.json');
    assert.deepEqual(result, ['osgi-config']);
  });

  // // Assuming mockZip represents a mocked Zip instance with specific entries
  // // This requires additional setup for mocking Zip and fs.realpathSync
  // it('should return content-package for content package .zip files', function () {
  //   const result = guessType(
  //     'package.zip',
  //     new URL('file:///package.zip'),
  //     undefined
  //   );
  //   assert.deepEqual(result, ['content-package']);
  // });

  // it('should return dispatcher-config for dispatcher config .zip files', function () {
  //   const result = guessType(
  //     'dispatcher.zip',
  //     new URL('file:///dispatcher.zip'),
  //     undefined
  //   );
  //   assert.deepEqual(result, ['dispatcher-config']);
  // });

  // it('should return frontend for frontend .zip files', function () {
  //   const result = guessType(
  //     'frontend.zip',
  //     new URL('file:///frontend.zip'),
  //     undefined
  //   );
  //   assert.deepEqual(result, ['frontend']);
  // });

  it('should return content-xml for .xml files with path flag', function () {
    const result = guessType(
      'content.xml',
      new URL('file:///content.xml'),
      'some/path'
    );
    assert.deepEqual(result, ['content-xml']);
  });

  it('should return content-file for unknown extension files with path flag', function () {
    const result = guessType(
      'image.jpg',
      new URL('file:///image.jpg'),
      'some/path'
    );
    assert.deepEqual(result, ['content-file']);
  });

  // it('should return all deployment types for .xml files without path flag', function () {
  //   const result = guessType('content.xml', new URL('file:///content.xml'));
  //   assert.deepEqual(result, deploymentTypes);
  // });

  // it('should return all deployment types for unknown extension files without path flag', function () {
  //   const result = guessType('image.jpg', new URL('file:///image.jpg'));
  //   assert.deepEqual(result, deploymentTypes);
  // });
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

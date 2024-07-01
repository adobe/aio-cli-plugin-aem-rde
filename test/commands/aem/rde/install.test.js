const assert = require('assert');
const rewire = require('rewire');
const JSZip = require('jszip');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const testee = rewire('../../../../src/commands/aem/rde/install');

let guessPath; // Declare variable to hold the function
let guessType; // Declare variable to hold the function

before(function () {
  guessPath = testee.__get__('guessPath');
  guessType = testee.__get__('guessType');
});

/**
 *
 * @param entries
 */
async function createMockZipFile(entries) {
  const zip = new JSZip();
  entries.forEach((entry) => {
    if (entry.isDirectory) {
      zip.folder(entry.name);
    } else {
      zip.file(entry.name, entry.content || '');
    }
  });
  const content = await zip.generateAsync({ type: 'nodebuffer' });
  const tempFilePath = path.join(os.tmpdir(), `mock-${Date.now()}.zip`);
  await fs.writeFile(tempFilePath, content);
  return tempFilePath;
}

describe('guessType without zips', function () {
  it('should return osgi-bundle for .jar files', function () {
    const result = guessType('example.jar');
    assert.deepEqual(result, ['osgi-bundle']);
  });

  it('should return osgi-config for .json files', function () {
    const result = guessType('config.json');
    assert.deepEqual(result, ['osgi-config']);
  });

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
});

describe('guessType with mocked zips', function () {
  let tempFiles = [];

  afterEach(async function () {
    // Cleanup: Delete temporary files
    await Promise.all(tempFiles.map((file) => fs.unlink(file)));
    tempFiles = [];
  });

  it('should return content-package for content package zip files', async function () {
    const tempFilePath = await createMockZipFile([
      { name: 'jcr_root/', isDirectory: true },
    ]);
    tempFiles.push(tempFilePath);
    const result = guessType('package.zip', new URL(`file://${tempFilePath}`));
    assert.deepEqual(result, ['content-package']);
  });

  it('should return dispatcher-config for dispatcher config zip files', async function () {
    const tempFilePath = await createMockZipFile([
      { name: 'conf.dispatcher.d/', isDirectory: true },
    ]);
    tempFiles.push(tempFilePath);
    const result = guessType(
      'dispatcher.zip',
      new URL(`file://${tempFilePath}`)
    );
    assert.deepEqual(result, ['dispatcher-config']);
  });

  it('should return frontend for frontend zip files', async function () {
    const tempFilePath = await createMockZipFile([
      { name: 'dist/', isDirectory: true },
      { name: 'package.json' },
    ]);
    tempFiles.push(tempFilePath);
    const result = guessType('frontend.zip', new URL(`file://${tempFilePath}`));
    assert.deepEqual(result, ['frontend']);
  });
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

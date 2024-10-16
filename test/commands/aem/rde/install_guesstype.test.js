const assert = require('assert');
const JSZip = require('jszip');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const DeployCommand = require('../../../../src/commands/aem/rde/install.js');

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

let deployCommand;
before(function () {
  deployCommand = new DeployCommand();
});

describe('guessType without zips', function () {
  it('should return osgi-bundle for .jar files', function () {
    const result = deployCommand.guessType('example.jar');
    assert.deepEqual(result, ['osgi-bundle']);
  });

  it('should return osgi-config for .json files', function () {
    const result = deployCommand.guessType('config.json');
    assert.deepEqual(result, ['osgi-config']);
  });

  it('should return content-xml for .xml files with path flag', function () {
    const result = deployCommand.guessType(
      'content.xml',
      new URL('file:///content.xml'),
      'some/path'
    );
    assert.deepEqual(result, ['content-xml']);
  });

  it('should return content-file for unknown extension files with path flag', function () {
    const result = deployCommand.guessType(
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
    const result = deployCommand.guessType(
      'package.zip',
      new URL(`file://${tempFilePath}`)
    );
    assert.deepEqual(result, ['content-package']);
  });

  it('should return dispatcher-config for dispatcher config zip files', async function () {
    const tempFilePath = await createMockZipFile([
      { name: 'conf.dispatcher.d/', isDirectory: true },
    ]);
    tempFiles.push(tempFilePath);
    const result = deployCommand.guessType(
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
    const result = deployCommand.guessType(
      'frontend.zip',
      new URL(`file://${tempFilePath}`)
    );
    assert.deepEqual(result, ['frontend']);
  });
});

const assert = require('assert');
const rewire = require('rewire');
const JSZip = require('jszip');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const sinon = require('sinon');

const testee = rewire('../../../../src/commands/aem/rde/install');

let guessPath;
let guessType;
let flags;
let getPath;
let getType;

before(function () {
  guessPath = testee.__get__('guessPath');
  guessType = testee.__get__('guessType');
  getPath = testee.__get__('getPath');
  getType = testee.__get__('getType');
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

describe('.getPath', function () {
  beforeEach(function () {
    flags = {};
  });

  it('should update flags.path for content-file type with valid inputPath', function () {
    getPath.call(
      { doLog: () => {} },
      'content-file',
      flags,
      true,
      '/some/path/jcr_root/content/myproject'
    );
    assert.equal(flags.path, 'content/myproject');
  });

  it('should update flags.path for content-xml type with valid inputPath', function () {
    getPath.call(
      { doLog: () => {} },
      'content-xml',
      flags,
      true,
      '/some/path/jcr_root/content/myproject/content.xml'
    );
    assert.equal(flags.path, 'content/myproject/content');
  });

  it('should not update flags.path for non-content file types', function () {
    getPath.call(
      { doLog: () => {} },
      'osgi-bundle',
      flags,
      true,
      '/some/path/jcr_root/content/myproject'
    );
    assert.equal(flags.path, undefined);
  });

  it('should not update flags.path for content-file type without jcr_root in path', function () {
    getPath.call(
      { doLog: () => {} },
      'content-file',
      flags,
      true,
      '/some/path/content/myproject'
    );
    assert.equal(flags.path, undefined);
  });

  it('should not update flags.path if already set', function () {
    flags.path = 'already/set/path';
    getPath.call(
      { doLog: () => {} },
      'content-file',
      flags,
      true,
      '/some/path/jcr_root/content/myproject'
    );
    assert.equal(flags.path, 'already/set/path');
  });
});

describe('getType function tests', function () {
  let guessTypeStub;
  let expect;

  before(async function () {
    // Dynamically import chai and extract expect
    const chai = await import('chai');
    expect = chai.expect;
  });

  beforeEach(function () {
    // Before each test, stub the guessType function
    guessTypeStub = sinon.stub();
    testee.__set__('guessType', guessTypeStub);
  });

  it('should return the provided type and fileName', function () {
    const type = 'content-package';
    const fileName = 'example.zip';

    const result = getType.call(
      { doLog: () => {} },
      type,
      fileName,
      new URL('http://example.com'),
      '/path/to/example.zip',
      false,
      new URL('http://example.com')
    );
    expect(result).to.deep.equal({ type, fileName });
  });

  it('should guess the type when not provided and return it with fileName', function () {
    guessTypeStub.returns(['content-package']);
    const fileName = 'example.zip';
    const result = getType.call(
      { doLog: () => {} },
      undefined,
      fileName,
      new URL('http://example.com'),
      '/path/to/example.zip',
      false,
      new URL('http://example.com')
    );
    expect(result.type).to.equal('content-package');
    expect(result.fileName).to.equal(fileName);
  });

  it('should try to guess the type again with original URL on redirect', function () {
    guessTypeStub.onFirstCall().returns(testee.__get__('deploymentTypes'));
    guessTypeStub.onSecondCall().returns(['content-package']);
    const fileName = 'example.zip';
    const result = getType.call(
      { doLog: () => {} },
      undefined,
      fileName,
      new URL('http://example.com/redirected'),
      '/path/to/example.zip',
      false,
      new URL('http://original.com')
    );
    expect(result.type).to.equal('content-package');
  });

  it('should throw validation error when guessType returns multiple types', function () {
    guessTypeStub.returns(['content-package', 'content-file']);
    const fileName = 'example.zip';
    expect(() =>
      getType.call(
        { doLog: () => {} },
        undefined,
        fileName,
        new URL('http://example.com'),
        '/path/to/example.zip',
        false,
        new URL('http://example.com')
      )
    ).to.throw();
  });

  it('should throw validation error when guessType cannot determine the type', function () {
    guessTypeStub.returns([]);
    const fileName = 'example.zip';
    expect(() =>
      getType.call(
        { doLog: () => {} },
        undefined,
        fileName,
        new URL('http://example.com'),
        '/path/to/example.zip',
        false,
        new URL('http://example.com')
      )
    ).to.throw();
  });

  afterEach(function () {
    // Restore the original function after each test
    sinon.restore();
  });
});

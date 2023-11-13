const assert = require('assert');
const sinon = require('sinon').createSandbox();
const Archiver = require('archiver');
const { archiveDirectory, addDirectoryToArchive } = require('../../../../src/commands/aem/rde/install.js'); 
const { cli } = require('../../../../src/lib/base-command');
const fs = require('fs').promises;
const path = require('path');

describe('Archive Utility', function () {
  let sourceDir;
  let outputFilePath;

  before(async function () {
    // Create temporary directories
    sourceDir = './test-directory';
    outputFilePath = './test-output.zip';
    await fs.mkdir(sourceDir);
  });

  after(async function () {
    // Check if the file exists before unlinking
    try {
      await fs.access(outputFilePath);
      await fs.unlink(outputFilePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Delete temporary directories
    await fs.rm(sourceDir, { recursive: true });
  });

  describe('#archiveDirectory', function () {
    it('should call archiver.finalize() and log the finishing message', async function () {
      const archiverStub = {
        pipe: sinon.stub(),
        finalize: sinon.stub().resolves(),
      };
      const createWriteStreamStub = sinon.stub(fs, 'createWriteStream').returns({});
      sinon.stub(Archiver, 'create').withArgs('zip').returns(archiverStub);
      sinon.stub(cli, 'log');

      await archiveDirectory(sourceDir, outputFilePath);

      assert.ok(createWriteStreamStub.calledWith(outputFilePath));
      assert.ok(archiverStub.pipe.calledOnce);
      assert.ok(archiverStub.finalize.calledOnce);
      assert.ok(cli.log.calledWith(`Finished archiving ${outputFilePath}`));

      createWriteStreamStub.restore();
      Archiver.create.restore();
      cli.log.restore();
    });
  });

  describe('#addDirectoryToArchive', function () {
    it('should call archiver methods for files and directories', function () {
      const archiverStub = {
        file: sinon.stub(),
        symlink: sinon.stub(),
        pipe: sinon.stub(),
      };

      const readdirStub = sinon.stub(fs, 'readdir').resolves(['file1.txt', 'dir1']);
      const lstatStub = sinon.stub(fs, 'lstat');
      lstatStub.withArgs(path.join(sourceDir, 'file1.txt')).resolves({ isDirectory: () => false, isSymbolicLink: () => false });
      lstatStub.withArgs(path.join(sourceDir, 'dir1')).resolves({ isDirectory: () => true });

      const joinStub = sinon.stub(path, 'join');
      joinStub.withArgs(sourceDir, 'file1.txt').returns('file1Path');
      joinStub.withArgs('', 'file1.txt').returns('file1ArchivePath');
      joinStub.withArgs(sourceDir, 'dir1').returns('dir1Path');
      joinStub.withArgs('dir1Path', 'file2.txt').returns('dir1File2Path');
      joinStub.withArgs('dir1Path', 'subdir').returns('dir1SubdirPath');

      const archiver = Archiver.create('zip');
      addDirectoryToArchive(archiverStub, sourceDir, '');

      assert.ok(archiverStub.file.calledWith('file1Path', { name: 'file1ArchivePath' }));
      assert.ok(archiverStub.file.calledWith('dir1Path', { name: 'dir1Path' }));
      assert.ok(archiverStub.file.calledWith('dir1File2Path', { name: 'dir1File2Path' }));
      assert.ok(archiverStub.file.calledWith('dir1SubdirPath', { name: 'dir1SubdirPath' }));

      readdirStub.restore();
      lstatStub.restore();
      joinStub.restore();
    });
  });
});

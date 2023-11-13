const assert = require('assert');
const sinon = require('sinon').createSandbox();
const Archiver = require('archiver');
const { archiveDirectory, addDirectoryToArchive } = require('../../../../src/commands/aem/rde/install.js'); 
const { cli } = require('../../../../src/lib/base-command');
const fs = require('fs');
const path = require('path');

describe('Archive Utility', function () {
  describe('#archiveDirectory', function () {
    it('should call archiver.finalize() and log the finishing message', async function () {
      const archiverStub = {
        pipe: sinon.stub(),
        finalize: sinon.stub().resolves(),
      };
      const createWriteStreamStub = sinon.stub(fs, 'createWriteStream').returns({});
      sinon.stub(Archiver, 'create').returns(archiverStub);
      sinon.stub(cli, 'log');

      const sourceDir = './test-directory';
      const outputFilePath = './test-output.zip';

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

      const readdirSyncStub = sinon.stub(fs, 'readdirSync').returns(['file1.txt', 'dir1']);
      const lstatSyncStub = sinon.stub(fs, 'lstatSync');
      lstatSyncStub.onCall(0).returns({ isDirectory: () => false, isSymbolicLink: () => false });
      lstatSyncStub.onCall(1).returns({ isDirectory: () => true });

      const joinStub = sinon.stub(path, 'join');
      joinStub.withArgs('./test-directory', 'file1.txt').returns('file1Path');
      joinStub.withArgs('', 'file1.txt').returns('file1ArchivePath');
      joinStub.withArgs('./test-directory', 'dir1').returns('dir1Path');
      joinStub.withArgs('dir1Path', 'file2.txt').returns('dir1File2Path');
      joinStub.withArgs('dir1Path', 'subdir').returns('dir1SubdirPath');

      const archiver = Archiver.create();
      addDirectoryToArchive(archiverStub, './test-directory', '');

      assert.ok(archiverStub.file.calledWith('file1Path', { name: 'file1ArchivePath' }));
      assert.ok(archiverStub.file.calledWith('dir1Path', { name: 'dir1Path' }));
      assert.ok(archiverStub.file.calledWith('dir1File2Path', { name: 'dir1File2Path' }));
      assert.ok(archiverStub.file.calledWith('dir1SubdirPath', { name: 'dir1SubdirPath' }));

      readdirSyncStub.restore();
      lstatSyncStub.restore();
      joinStub.restore();
    });
  });
});

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Zip = require('adm-zip');
const { archiveDirectory, addDirectoryToArchive } = require('../../../../src/commands/aem/rde/install.js'); 

describe('archiveDirectory', () => {
  it('should create a ZIP archive from a directory', () => {
    const outputFilePath = 'test-output.zip';
    archiveDirectory('../../../../test/commands/aem/rde', outputFilePath); 

    const zip = new Zip(outputFilePath);
    const zipEntries = zip.getEntries();

    assert.ok(zipEntries.length > 0, 'ZIP archive should have entries');
    assert.strictEqual(zipEntries[0].entryName, 'file.txt', 'First entry should be "file.txt"');
    fs.unlinkSync(outputFilePath);
  });
});

describe('addDirectoryToArchive', () => {
  it('should add a directory to a ZIP archive', () => {
    const zip = new Zip();
    const sourceDir = '../../../../test/commands/aem/rde'; 
    addDirectoryToArchive(zip, sourceDir, '');

    const zipEntries = zip.getEntries();

    assert.ok(zipEntries.length > 0, 'ZIP archive should have entries');
    assert.strictEqual(zipEntries[0].entryName, 'file.txt', 'First entry should be "file.txt"');
  });
});

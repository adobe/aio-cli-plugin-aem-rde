/*
 * Copyright 2023 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const archiver = require('archiver');

async function dispatcherInputBuild(basecommand, inputPath) {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(path.join(os.tmpdir(), 'aio-rde-'), (err, folder) => {
      if (err) {
        return reject(err);
      }
      const targetZipPath = path.join(folder, 'dispatcher.zip');
      return archiveDirectory(basecommand, inputPath, targetZipPath)
        .then((zipSizeBytes) =>
          resolve({
            inputPath: fs.realpathSync(targetZipPath),
            inputPathSize: zipSizeBytes,
          })
        )
        .catch((err) => reject(err));
    });
  });
}

async function archiveDirectory(basecommand, sourceDir, outputFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', function () {
      const zipSizeBytes = archive.pointer();
      basecommand.log(
        `Zipped file ${outputFilePath} of ${zipSizeBytes} total bytes`
      );
      return resolve(zipSizeBytes);
    });

    archive.on('error', function (err) {
      return reject(err);
    });

    archive.pipe(output);
    addDirectoryToArchive(archive, sourceDir, '');
    archive.finalize().catch((err) => reject(err));
  });
}
/**
/**
 *
 * @param archive
 * @param sourceDir
 * @param archiveDir
 */
function addDirectoryToArchive(archive, sourceDir, archiveDir) {
  const files = fs.readdirSync(sourceDir);

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const archivePath = path.join(archiveDir, file);

    const stat = fs.lstatSync(filePath);
    if (stat.isDirectory()) {
      archive.file(filePath, { name: archivePath });
      addDirectoryToArchive(archive, filePath, archivePath);
    } else {
      if (stat.isSymbolicLink()) {
        const targetPath = fs.readlinkSync(filePath);
        archive.symlink(archivePath, targetPath, 0o644);
      } else {
        archive.file(filePath, { name: archivePath });
      }
    }
  }
}

module.exports = {
  dispatcherInputBuild,
};

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

/**
 * @param closure
 * @param successPredicate
 * @param retryIntervalSeconds
 * @param maxRetries
 * @param cli
 * @param inputPath
 */
async function dispatcherInputBuild(cli, inputPath) {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(path.join(os.tmpdir(), 'aio-rde-'), (err, folder) => {
      if (err) {
        return reject(err);
      }
      const targetZipPath = path.join(folder, 'dispatcher.zip');
      return archiveDirectory(cli, inputPath, targetZipPath)
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

/**
 *
 * @param cli
 * @param sourceDir
 * @param outputFilePath
 */
async function archiveDirectory(cli, sourceDir, outputFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', function () {
      const zipSizeBytes = archive.pointer();
      cli.log(`Zipped file ${outputFilePath} of ${zipSizeBytes} total bytes`);
      return resolve(zipSizeBytes);
    });

    archive.on('error', function (err) {
      return reject(err);
    });

    archive.pipe(output);
    archive.glob('**/*', { cwd: sourceDir });
    archive.finalize().catch((err) => reject(err));
  });
}

module.exports = {
  dispatcherInputBuild,
};

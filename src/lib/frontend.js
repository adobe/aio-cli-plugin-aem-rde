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

async function frontendInputBuild(basecommand, inputPath) {
  return new Promise((resolve, reject) => {
    // analyse that dist/ folder and package.json folder are present on this directory
    const distInputPath = path.join(inputPath, 'dist');
    const pkgJsonInputPath = path.join(inputPath, 'package.json');
    let valid = true;
    if (!fs.existsSync(distInputPath)) {
      valid = false;
      basecommand.doLog(
        `Error: There is no 'dist' folder in ${inputPath}. Please, run 'npm run build' in the project folder before running this command.`
      );
    }
    if (!fs.existsSync(pkgJsonInputPath)) {
      valid = false;
      basecommand.doLog(
        `Error: There is no 'package.json' file in ${inputPath}. Ensure you're sending the right folder which contains your frontend-pipeline project.`
      );
    }
    if (!valid) {
      return reject(
        new Error(
          'There were some validation errors when processing zip file for the frontend-pipeline input path'
        )
      );
    }

    fs.mkdtemp(path.join(os.tmpdir(), 'aio-rde-'), (err, folder) => {
      if (err) {
        return reject(err);
      }
      const targetZipPath = path.join(folder, 'frontend-pipeline.zip');
      const output = fs.createWriteStream(targetZipPath);
      const archive = archiver('zip');
      let zipSizeBytes;
      output.on('close', function () {
        zipSizeBytes = archive.pointer();
        basecommand.doLog(
          `Zipped file ${targetZipPath} of ${zipSizeBytes} total bytes`
        );
        return resolve({
          inputPath: fs.realpathSync(targetZipPath),
          inputPathSize: zipSizeBytes,
        });
      });
      archive.on('error', function (err) {
        return reject(err);
      });
      archive.pipe(output);
      // append files from a sub-directory
      archive.directory(distInputPath, 'dist');
      archive.file(pkgJsonInputPath, { name: 'package.json' });
      archive.finalize();
    });
  });
}

module.exports = {
  frontendInputBuild,
};

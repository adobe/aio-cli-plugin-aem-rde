/*
 * Copyright 2022 Adobe Inc. All rights reserved.
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

const {
  BaseCommand,
  cli,
  commonFlags,
  Flags,
} = require('../../../lib/base-command');
const {
  loadUpdateHistory,
  throwOnInstallError,
} = require('../../../lib/rde-utils');
const { frontendInputBuild } = require('../../../lib/frontend');
const { dispatcherInputBuild } = require('../../../lib/dispatcher');
const { basename } = require('path');
const fs = require('fs');
const fetch = require('@adobe/aio-lib-core-networking').createFetch();
const { URL, pathToFileURL } = require('url');
const chalk = require('chalk');

const Zip = require('adm-zip');
const { codes: validationCodes } = require('../../../lib/validation-errors');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');

const JCR_ROOT = 'jcr_root';

const deploymentTypes = [
  'osgi-bundle',
  'osgi-config',
  'content-package',
  'content-file',
  'content-xml',
  'dispatcher-config',
  'frontend',
];

/**
 *
 */
function createProgressBar() {
  return cli.progress({
    format: 'Uploading {bar} {percentage}% | ETA: {eta}s | {value}/{total} KB',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    stopOnComplete: true,
    formatValue: function (v, options, type) {
      // padding
      /**
       * @param value
       * @param length
       */
      function autopadding(value, length) {
        return (options.autopaddingChar + value).slice(-length);
      }

      /**
       * @param value
       */
      function toKiloBytes(value) {
        return Math.round(value / 1024);
      }

      switch (type) {
        case 'percentage':
          // no autopadding ? passthrough
          if (options.autopadding !== true) {
            return v;
          }
          return autopadding(v, 3);
        case 'value':
        case 'total':
          return toKiloBytes(v);
        default:
          return v;
      }
    },
  });
}

/**
 * @param url
 */
async function computeStats(url) {
  switch (url.protocol) {
    case 'http:':
    case 'https:': {
      const con = await fetch(url, { method: 'HEAD' });
      const effectiveUrl = con.url ? new URL(con.url) : url;
      return {
        fileSize: parseInt(con.headers.get('content-length')),
        effectiveUrl,
        path: effectiveUrl.pathname,
        isLocalFile: false,
      };
    }
    case 'file:': {
      const path = fs.realpathSync(url);
      return {
        fileSize: fs.statSync(path).size,
        effectiveUrl: url,
        path,
        isLocalFile: true,
      };
    }
    default:
      throw new validationCodes.UNSUPPORTED_PROTOCOL({
        messageValues: url.protocol,
      });
  }
}

class DeployCommand extends BaseCommand {
  /**
   * @param isLocalFile
   * @param type
   * @param path
   * @param inputPath
   */
  async processInputFile(isLocalFile, type, inputPath) {
    if (!isLocalFile) {
      // don't do anything if we're processing a remote file
      return;
    }
    const file = fs.lstatSync(inputPath);
    switch (type) {
      case 'frontend': {
        if (!file.isDirectory()) {
          break;
        }
        return await frontendInputBuild(this, inputPath);
      }
      case 'dispatcher-config': {
        if (!file.isDirectory()) {
          break;
        }
        return await dispatcherInputBuild(this, inputPath);
      }
      default: {
        if (file.isDirectory()) {
          throw new Error(
            `A directory was specified for an unsupported type. Please, make sure you have specified the type and provided the correct input for the command. Supported types for directories input usage: [frontend, dispatcher-config], current input type is "${type}"`
          );
        }
      }
    }
  }

  async runCommand(args, flags) {
    let progressBar;
    if (!flags.quiet && !flags.json) {
      progressBar = createProgressBar();
    }
    const originalUrl = args.location;
    const { fileSize, effectiveUrl, path, isLocalFile } =
      await computeStats(originalUrl);
    let type = flags.type;

    const { inputPath, inputPathSize } = (await this.processInputFile(
      isLocalFile,
      type,
      path
    )) || {
      inputPath: path,
      inputPathSize: fileSize,
    };

    let fileName = basename(inputPath);
    try {
      ({ type, fileName } = getType(
        type,
        fileName,
        effectiveUrl,
        inputPath,
        isLocalFile,
        originalUrl
      ));

      // when no path was defined explicitly, we also try to guess it
      getPath(type, flags, isLocalFile, inputPath);
    } catch (err) {
      this.doLog(err);
      return;
    }

    const result = this.jsonResult();
    result.items = [];

    let change;
    try {
      change = await doDeployment(
        change,
        flags,
        progressBar,
        isLocalFile,
        inputPathSize,
        fileSize,
        inputPath,
        effectiveUrl,
        fileName,
        type,
        result
      );
      progressBar?.stop();
      return result;
    } catch (err) {
      progressBar?.stop();
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_INSTALL_ERROR({ messageValues: err })
      );
    }

    await this.withCloudSdk((cloudSdkAPI) =>
      throwOnInstallError(cloudSdkAPI, change.updateId, (done, text) =>
        done ? this.spinnerStop() : this.spinnerStart(text)
      )
    );
  }

  /**
   *
   * @param change
   * @param flags
   * @param progressBar
   * @param isLocalFile
   * @param inputPathSize
   * @param fileSize
   * @param inputPath
   * @param effectiveUrl
   * @param fileName
   * @param type
   * @param result
   */
  async doDeployment(
    change,
    flags,
    progressBar,
    isLocalFile,
    inputPathSize,
    fileSize,
    inputPath,
    effectiveUrl,
    fileName,
    type,
    result
  ) {
    change = await this.withCloudSdk((cloudSdkAPI) => {
      let uploadCallbacks;
      if (!flags.json && !flags.quiet) {
        uploadCallbacks = {
          progress: (copiedBytes) => progressBar.update(copiedBytes),
          abort: () => progressBar.stop(),
          start: (size, msg) => {
            if (msg) {
              this.doLog(msg);
            }
            progressBar.start(size, 0);
          },
        };
      }

      const deploymentCallbacks = () => {
        if (!this.spinnerIsSpinning()) {
          this.spinnerStart('applying update');
        }
      };

      const deploy = isLocalFile
        ? cloudSdkAPI.deployFile
        : cloudSdkAPI.deployURL;
      return deploy.call(
        cloudSdkAPI,
        inputPathSize || fileSize,
        isLocalFile ? inputPath : effectiveUrl.toString(),
        fileName,
        type,
        flags.target,
        type === 'osgi-config' ? fileName : flags.path,
        flags.force,
        uploadCallbacks,
        deploymentCallbacks
      );
    }).finally(() => this.spinnerStop());

    await this.withCloudSdk((cloudSdkAPI) =>
      loadUpdateHistory(
        cloudSdkAPI,
        change.updateId,
        this,
        (done, text) => (done ? this.spinnerStop() : this.spinnerStart(text)),
        result.items
      )
    );
    return change;
  }
}

/**
 *
 * @param type
 * @param fileName
 * @param effectiveUrl
 * @param inputPath
 * @param isLocalFile
 * @param originalUrl
 */
function getType(
  type,
  fileName,
  effectiveUrl,
  inputPath,
  isLocalFile,
  originalUrl
) {
  if (!type) {
    let guessedTypes = guessType(fileName, effectiveUrl, inputPath);
    if (
      !isLocalFile &&
      guessedTypes === deploymentTypes &&
      effectiveUrl !== originalUrl
    ) {
      // when there was a redirect, it is possible that the original URL
      // has a file extension, but not the effective URL, so we try again
      fileName = basename(originalUrl.pathname);
      guessedTypes = guessType(fileName, originalUrl, inputPath);
    }
    if (guessedTypes.length !== 1) {
      throw new validationCodes.INVALID_GUESS_TYPE({
        messageValues: guessedTypes.join(', '),
      });
    } else {
      type = guessedTypes[0];
      this.doLog(chalk.yellow(`No --type provided, using ${type}`));
    }
  }
  return { type, fileName };
}

/**
 *
 * @param type
 * @param flags
 * @param isLocalFile
 * @param inputPath
 */
function getPath(type, flags, isLocalFile, inputPath) {
  if ((type === 'content-file' || type === 'content-xml') && !flags.path) {
    if (isLocalFile && inputPath.includes('/' + JCR_ROOT + '/')) {
      const guessedPath = guessPath(inputPath);
      if (guessedPath) {
        flags.path = guessedPath;
        this.doLog(
          chalk.yellow(
            `No --path provided, repository path was set to ${flags.path}`
          )
        );
      } else {
        throw new validationCodes.MISSING_CONTENT_PATH();
      }
    }
  }
}

/**
 *
 * @param inputPath
 */
function guessPath(inputPath) {
  const JCR_ROOT_SUBPATH = '/' + JCR_ROOT + '/';
  if (!inputPath.includes(JCR_ROOT)) {
    return;
  }
  const extension = inputPath.substring(inputPath.lastIndexOf('.'));
  if (extension === '.xml') {
    return inputPath.substring(
      inputPath.lastIndexOf(JCR_ROOT_SUBPATH) + JCR_ROOT_SUBPATH.length,
      inputPath.lastIndexOf(
        inputPath.endsWith('/.content.xml') ? '/.content.xml' : '.xml'
      )
    );
  }
  return inputPath.substring(
    inputPath.lastIndexOf(JCR_ROOT_SUBPATH) + JCR_ROOT_SUBPATH.length
  );
}

/**
 *
 * @param name
 * @param url
 * @param pathFlag
 */
function guessType(name, url, pathFlag) {
  const extension = name.substring(name.lastIndexOf('.'));
  switch (extension) {
    case '.jar':
      return ['osgi-bundle'];
    case '.json':
      return ['osgi-config'];
    case '.zip':
      if (url.protocol === 'file:') {
        const zip = new Zip(fs.realpathSync(url), {});
        const isContentPackage = zip.getEntry(JCR_ROOT + '/') !== null;
        if (isContentPackage) {
          return ['content-package'];
        }
        const isDispatcherConfig = zip.getEntry('conf.dispatcher.d/') !== null;
        if (isDispatcherConfig) {
          return ['dispatcher-config'];
        }
        const isFrontend =
          zip.getEntry('dist/') !== null &&
          zip.getEntry('package.json') !== null;
        if (isFrontend) {
          return ['frontend'];
        }
      }
      return ['content-package', 'dispatcher-config', 'frontend'];
    case '.xml':
      return pathFlag !== undefined ? ['content-xml'] : deploymentTypes;
    default:
      return pathFlag !== undefined ? ['content-file'] : deploymentTypes;
  }
}

Object.assign(DeployCommand, {
  description:
    'Install/update bundles, configs, and content-packages. When installing content-files, the path flag must be provided.',
  args: [
    {
      name: 'location',
      description:
        'Location (public accessible url or path on local file system) to an artifact',
      required: true,
      parse: async (location) => {
        if (location.startsWith('https://') || location.startsWith('http://')) {
          return new URL(location);
        } else {
          // remove file:// if present
          const filePath = location.replace(/^file:\/\//, '');
          return pathToFileURL(filePath);
        }
      },
    },
  ],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.target,
    type: Flags.string({
      char: 't',
      description: 'the type to deploy',
      multiple: false,
      required: false,
      options: deploymentTypes,
    }),
    path: Flags.string({
      char: 'p',
      description: 'the path in case this is a content-file',
      multiple: false,
      required: false,
    }),
    force: Flags.boolean({
      char: 'f',
      multiple: false,
      required: false,
    }),
    quiet: commonFlags.quiet,
  },
  aliases: [],
});

module.exports = DeployCommand;

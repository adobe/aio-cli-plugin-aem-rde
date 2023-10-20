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
const { basename } = require('path');
const fs = require('fs');
const fetch = require('@adobe/aio-lib-core-networking').createFetch();
const { URL, pathToFileURL } = require('url');
const spinner = require('ora')();
const Zip = require('adm-zip');
const { codes: validationCodes } = require('../../../lib/validation-errors');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { AioError } = require('../../../lib/errors');

const deploymentTypes = [
  'osgi-bundle',
  'osgi-config',
  'content-package',
  'content-file',
  'content-xml',
  'dispatcher-config',
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
  async run() {
    const { args, flags } = await this.parse(DeployCommand);
    const progressBar = createProgressBar();

    const originalUrl = args.location;
    const { fileSize, effectiveUrl, path, isLocalFile } = await computeStats(
      originalUrl
    );
    let fileName = basename(path);
    let type = flags.type;
    if (!type) {
      let guessedTypes = guessType(fileName, effectiveUrl, flags.path);
      if (
        !isLocalFile &&
        guessedTypes === deploymentTypes &&
        effectiveUrl !== originalUrl
      ) {
        // when there was a redirect, it is possible that the original URL
        // has a file extension, but not the effective URL, so we try again
        fileName = basename(originalUrl.pathname);
        guessedTypes = guessType(fileName, originalUrl, flags.path);
      }
      if (guessedTypes.length !== 1) {
        throw new validationCodes.INVALID_GUESS_TYPE({
          messageValues: guessedTypes.join(', '),
        });
      } else {
        type = guessedTypes[0];
      }
    }

    let change;
    try {
      change = await this.withCloudSdk((cloudSdkAPI) => {
        const uploadCallbacks = {
          progress: (copiedBytes) => progressBar.update(copiedBytes),
          abort: () => progressBar.stop(),
          start: (size, msg) => {
            if (msg) {
              cli.log(msg);
            }
            progressBar.start(size, 0);
          },
        };

        const deploymentCallbacks = () => {
          if (!spinner.isSpinning) {
            spinner.start('applying update');
          }
        };

        const deploy = isLocalFile
          ? cloudSdkAPI.deployFile
          : cloudSdkAPI.deployURL;
        return deploy.call(
          cloudSdkAPI,
          fileSize,
          isLocalFile ? path : effectiveUrl.toString(),
          fileName,
          type,
          flags.target,
          type === 'osgi-config' ? fileName : flags.path,
          flags.force,
          uploadCallbacks,
          deploymentCallbacks
        );
      }).finally(() => spinner.stop());

      await this.withCloudSdk((cloudSdkAPI) =>
        loadUpdateHistory(cloudSdkAPI, change.updateId, cli, (done, text) =>
          done ? spinner.stop() : spinner.start(text)
        )
      );
    } catch (err) {
      progressBar.stop();
      spinner.stop();
      if (err instanceof AioError) {
        throw err;
      }
      throw new internalCodes.INTERNAL_INSTALL_ERROR({ messageValues: err });
    }

    await this.withCloudSdk((cloudSdkAPI) =>
      throwOnInstallError(cloudSdkAPI, change.updateId, (done, text) =>
        done ? spinner.stop() : spinner.start(text)
      )
    );
  }
}

/**
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
        const isContentPackage = zip.getEntry('jcr_root/') !== null;
        if (isContentPackage) {
          return ['content-package'];
        }
        const isDispatcherConfig = zip.getEntry('conf.dispatcher.d/') !== null;
        if (isDispatcherConfig) {
          return ['dispatcher-config'];
        }
      }
      return ['content-package', 'dispatcher-config'];
    case '.xml':
      return pathFlag !== undefined ? ['content-xml'] : deploymentTypes;
    default:
      return pathFlag !== undefined ? ['content-file'] : deploymentTypes;
  }
}

Object.assign(DeployCommand, {
  description: 'Install/update bundles, configs, and content-packages.',
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
  },
  aliases: [],
});

module.exports = DeployCommand;

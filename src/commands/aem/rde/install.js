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

const {BaseCommand, cli, commonFlags, Flags} = require('../../../lib/base-command')
const {loadUpdateHistory} = require("../../../lib/rde-utils");
const {basename} = require('path');
const fs = require('fs');
const fetch = require('@adobe/aio-lib-core-networking').createFetch();
const {URL, pathToFileURL} = require('url');
const spinner = require('ora')();
const Zip = require('adm-zip');

function createProgressBar() {
  return cli.progress({
    format: 'Uploading {bar} {percentage}% | ETA: {eta}s | {value}/{total} KB',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    stopOnComplete: true,
    formatValue: function (v, options, type) {
      // padding
      function autopadding(value, length) {
        return (options.autopaddingChar + value).slice(-length);
      }

      function toKiloBytes(value) {
        return Math.round(value / 1024)
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
    }
  });
}

async function computeStats(url) {
  switch (url.protocol) {
    case 'http:':
    case 'https:':
      let con = (await fetch(url, { method: 'HEAD' }));
      let effectiveUrl = !!con.url ? new URL(con.url) : url;
      return {
        fileSize: parseInt(con.headers.get('content-length')),
        effectiveUrl,
        path: effectiveUrl.pathname,
        isLocalFile: false
      };
    case 'file:':
      let path = fs.realpathSync(url);
      return {
        fileSize: fs.statSync(path).size,
        effectiveUrl: url,
        path,
        isLocalFile: true
      };
    default:
      throw `Unsupported protocol ${url.protocol}`
  }
}

class DeployCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(DeployCommand)
    const progressBar = createProgressBar();

    try {
      let { fileSize, effectiveUrl, path } = await computeStats(args.location);
      let fileName = basename(path);
      let type = flags.type || guessType(fileName, effectiveUrl, flags.path);

      let change = await this.withCloudSdk(cloudSdkAPI => {
        progressBar.start(fileSize, 0)
        let copyProgressCallback = (copiedBytes) => {
            progressBar.update(copiedBytes)
        }

        let progressCallback = () => {
          if (!spinner.isSpinning) {
            spinner.start('applying update')
          }
        }

        let deploy = isLocalFile ? cloudSdkAPI.deployFile : cloudSdkAPI.deployURL;
        return deploy.call(
          cloudSdkAPI,
          fileSize,
          isLocalFile ? path : effectiveUrl.toString(),
          fileName,
          type,
          flags.target,
          type === 'osgi-config' ? fileName : flags.path,
          flags.force,
          copyProgressCallback,
          progressCallback);
      }).finally(() => spinner.stop());

      await this.withCloudSdk(cloudSdkAPI => loadUpdateHistory(
          cloudSdkAPI,
          change.updateId,
          cli,
          (done, text) => done ? spinner.stop() : spinner.start(text)
      ));
    } catch (err) {
      progressBar.stop();
      spinner.stop();
      cli.log(err);
    }
  }
}


function guessType(name, url, pathFlag) {
  let extension = name.substring(name.lastIndexOf('.'));
  switch (extension) {
    case '.jar':
      return 'osgi-bundle';
    case '.json':
      return 'osgi-config';
    case '.zip':
      if (url.protocol === 'file:') {
        let zip = new Zip(fs.realpathSync(url), {});
        let isContentPackage = zip.getEntry('jcr_root/') !== null
        if (isContentPackage) {
          return 'content-package';
        }
        let isDispatcherConfig = zip.getEntry('conf.dispatcher.d/') !== null
        if (isDispatcherConfig) {
          return 'dispatcher-config'
        }
      }
      return 'content-package';
    case '.xml':
      return pathFlag !== undefined ? 'content-xml' : '';
    default:
      return pathFlag !== undefined ? 'content-file' : '';
  }
}

Object.assign(DeployCommand, {
  description: 'Install/update bundles, configs, and content-packages.',
  args: [
    {
      name: 'location',
      description: 'Location (public accessible url or path on local file system) to an artifact',
      required: true,
      parse: async location => {
        if (location.startsWith('https://') || location.startsWith('http://')) {
          return new URL(location);
        } else {
          // remove file:// if present
          let filePath = location.replace(new RegExp("^file://"), '')
          return  pathToFileURL(filePath);
        }
      }
    }
  ],
  flags: {
    target: commonFlags.target,
    type: Flags.string({
      char: 't',
      description: 'the type to deploy',
      multiple: false,
      required: false,
      options: [
        'osgi-bundle',
        'osgi-config',
        'content-package',
        'content-file',
        'content-xml',
        'dispatcher-config'
      ]
    }),
    path: Flags.string({
      char: 'p',
      description: 'the path in case this is a content-file',
      multiple: false,
      required: false
    }),
    force: Flags.boolean({
      char: 'f',
      multiple: false,
      required: false
    })
  },
  aliases: [],
})

module.exports = DeployCommand

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

const { BaseCommand, cli, commonFlags, Flags } = require('../../../lib/base-command')
const { basename } = require("path");
const fs = require("fs");
const { createFetch } = require('@adobe/aio-lib-core-networking');
const fetch = createFetch();
const fileURL = require('url');

class DeployCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(DeployCommand)
    try {
      let change = await this.withCloudSdk(cloudSdkAPI => {
        let type;
        if (flags.path) {
          if (flags.type) {
            if (flags.type === 'content-xml') {
              type = flags.type;
            } else {
              type = 'content-file'
            }
          } else {
            type = 'content-file'
          }
        } else if (flags.type) {
          type = flags.type
        } else {
          type = args.location.type
        }
        if (args.location.url.protocol === 'file:') {
          return cloudSdkAPI.deployFile(
            args.location.fileSize,
            args.location.path,
            args.location.name,
            type,
            flags.target,
            type === 'osgi-config' ? args.location.name : flags.path,
            flags.force,
            (progress) => {cli.log(progress)},
            () => {cli.log('.')});
        } else {
          return cloudSdkAPI.deployURL(
            args.location.fileSize,
            args.location.url.toString(),
            args.location.name,
            type,
            flags.target,
            type === 'osgi-config' ? args.location.name : flags.path,
            flags.force,
            (progress) => {cli.log(progress)},
            () => {cli.log('.')});
        }
      });
      this.logChange(change);

      let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getLogs(change.updateId));
      if (response.status === 200) {
        let log = await response.text();
        try {
          let json = JSON.parse(log);
          if (json.length > 0) {
            cli.log(`Logs:`)
            json.forEach((line) => {
              cli.log(line)
            })
          }
        } catch (err) {
          cli.log(log);
        }
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`)
      }
    } catch (err) {
      cli.log(err);
    }
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
        let url;
        if (location.startsWith('https:') ||
          location.startsWith('file:') ||
          location.startsWith('http:') ) {
            url = new URL(location);
        } else {
          url = fileURL.pathToFileURL(location.replace(/\\ /, ' '));
        }
        let path;
        if (url.protocol === 'file:') {
          path = fs.realpathSync(url);
        } else {
          path = url.pathname;
        }
        let name = basename(url.pathname);
        let type = name.endsWith('.jar') ?
          'osgi-bundle' :
          name.endsWith('.zip') ?
            'content-package' :
            name.endsWith('.json') ?
              'osgi-config' : '';

        let fileSize;
        if (url.protocol === 'file:') {
          fileSize = fs.statSync(path).size;
        } else {
          let con = (await fetch(url, { method: 'HEAD' }));

          fileSize = parseInt(con.headers.get('content-length'));

          if (con.url) {
            url = new URL(con.url);
            if (type === '') {
              path = url.pathname;
              name = basename(url.pathname);
              type = name.endsWith('.jar') ?
                'osgi-bundle' :
                name.endsWith('.zip') ?
                  'content-package' :
                  name.endsWith('.json') ?
                    'osgi-config' : '';
            }
          }
        }
        return {
          path: path,
          url: url,
          name: name,
          fileSize: fileSize,
          type: name.endsWith('.jar') ?
            'osgi-bundle' :
            name.endsWith('.zip') ?
              'content-package' :
              name.endsWith('.json') ?
                'osgi-config' : ''
        };
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

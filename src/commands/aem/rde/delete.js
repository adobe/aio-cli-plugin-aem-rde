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

class DeleteCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(DeleteCommand)
    try {
      let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getStatus());
      if (response.status === 200) {
        let json = await response.json();
        let bundlesAuthor = [];
        let bundlesPublish = [];
        let configsAuthor = [];
        let configsPublish = [];
        json.items.forEach(artifact => {
          if (artifact.service === 'author') {
            if (artifact.type === 'osgi-bundle') {
              bundlesAuthor.push(artifact);
            } else {
              configsAuthor.push(artifact);
            }
          } else {
            if (artifact.type === 'osgi-bundle') {
              bundlesPublish.push(artifact);
            } else {
              configsPublish.push(artifact);
            }
          }
        });
        let artifacts = [];
        if (!flags.type || flags.type === 'osgi-bundle') {
          if (!flags.target || flags.target === 'author') {
            bundlesAuthor.forEach(bundle => {
              if (bundle.metadata.bundleSymbolicName === args.id ||
                `${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}` === args.id) {
                artifacts.push(bundle);
              }
            })
          }
          if (!flags.target || flags.target === 'publish') {
            bundlesPublish.forEach(bundle => {
              if (bundle.metadata.bundleSymbolicName === args.id ||
                `${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}` === args.id) {
                artifacts.push(bundle);
              }
            })
          }
        }
        if (!flags.type || flags.type === 'osgi-config') {
          if (!flags.target || flags.target === 'author') {
            configsAuthor.forEach(bundle => {
              if (bundle.metadata.configPid === args.id) {
                artifacts.push(bundle);
              }
            })
          }
          if (!flags.target || flags.target === 'publish') {
            configsPublish.forEach(bundle => {
              if (bundle.metadata.configPid === args.id) {
                artifacts.push(bundle);
              }
            })
          }
        }

        for (let artifact of artifacts) {
          let change = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.delete(artifact.id, flags.force));
          this.logChange(change);
          let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getLogs(change.updateId));
          if (response.status == 200) {
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
        }
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`)
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(DeleteCommand, {
  description: 'Delete bundles and configs from the current rde.',
  args: [{
    name: 'id',
    description: 'the id (bsn or pid) to delete',
    multiple: false,
    required: true
    }],
  flags: {
    target: commonFlags.target,
    type: Flags.string({
      char: 't',
      description: 'the type (osgi-bundle|osgi-config)',
      multiple: false,
      required: false,
      options: [
        'osgi-config',
        'osgi-bundle']
    }),
    force: Flags.boolean({
      char: 'f',
      multiple: false,
      required: false
    })
  },
  aliases: [],
})

module.exports = DeleteCommand

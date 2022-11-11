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

const { BaseCommand, cli } = require('../../../lib/base-command')

class StatusCommand extends BaseCommand {
  async run() {
    try {
      let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getStatus());
      cli.log(`Info for cm-p${this._programId}-e${this._environmentId}`)
      if (response.status === 200) {
        let json = await response.json();

        cli.log(`Environment: ${json.status}`)

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
        cli.log('- Bundles Author:')
        bundlesAuthor.forEach(bundle => cli.log(` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`))
        cli.log('- Bundles Publish:')
        bundlesPublish.forEach(bundle => cli.log(` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`))

        cli.log('- Configurations Author:')
        configsAuthor.forEach(config => cli.log(` ${config.metadata.configPid} `))


        cli.log('- Configurations Publish:')
        configsPublish.forEach(config => cli.log(` ${config.metadata.configPid} `))
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`)
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(StatusCommand, {
  description: 'Get a list of the bundles and configs deployed to the current rde.',
  args: [],
  aliases: [],
})

module.exports = StatusCommand

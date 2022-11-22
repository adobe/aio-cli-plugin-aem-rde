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

const { BaseCommand, cli} = require('../../../lib/base-command')

class ChangesCommand extends BaseCommand {
  async run() {
    const { args } = await this.parse(ChangesCommand)
    try {
      if (!args.id) {
        let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getChanges());
        if (response.status === 200) {
          let json = await response.json();
          if (json.items.length === 0) {
            cli.log('There are no changes yet.')
          } else {
            json.items.forEach(this.logChange);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`)
        }
      } else {
        let response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getChange(args.id));
        if (response.status === 200) {
          let change = await response.json();
          response = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.getLogs(args.id));
          if (response.status === 200) {
            this.logChange(change);
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
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`)
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(ChangesCommand, {
  description: 'Get a list of the updates done to the current rde.',
  args: [{
    name: 'id',
    description: 'The id of the update to get (including logs)',
    multiple: false,
    required: false
    }],
  aliases: [],
})

module.exports = ChangesCommand

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

const { BaseCommand, cli, commonFlags } = require('../../../../lib/base-command');

class SlingRequestsCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(SlingRequestsCommand);
    try {
      if (!args.id) {
        let params = {};
        params.filter = flags.include;

        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSlingRequests(flags.target, params)
        );
        if (response.status === 200) {
          let json = await response.json();
          cli.log(JSON.stringify(json, null, 2))
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSlingRequest(flags.target, args.id)
        );

        if (response.status === 200) {
          let slingRequest = await response.json();
          cli.log(JSON.stringify(slingRequest, null, 2))
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(SlingRequestsCommand, {
  description:
    'Get the list of sling-requests for the target of a rapid development environment.',
  args: [
    {
      name: 'id',
      description: 'The id of the sling-request to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
    include: commonFlags.include,
  },
});

module.exports = SlingRequestsCommand;

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
} = require('../../../../lib/base-command');

class RequestLogsCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(RequestLogsCommand);
    try {
      if (!args.id) {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getRequestLogs(flags.target)
        );
        if (response.status === 200) {
          let json = await response.json();
          cli.log('- Request Logs: ');
          json.items.forEach((requestLog) => {
            cli.log(json);
            cli.log(requestLog);
          });
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getRequestLog(flags.target, args.id)
        );
        if (response.status === 200) {
          let requestLog = await response.json();
          cli.log(`- Request Log "${args.id}": `);
          cli.log(requestLog);
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(RequestLogsCommand, {
  description:
    'Get the list of request-logs for the target of a rapid development environment.',
  args: [
    {
      name: 'id',
      description: 'The id of the request-log to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
  },
});

module.exports = RequestLogsCommand;

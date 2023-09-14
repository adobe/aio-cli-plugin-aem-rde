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

const { cli, commonFlags } = require('../../../../../lib/base-command');
const {
  logInJsonArrayFormat,
  InspectBaseCommand,
  inspectCommonFlags,
} = require('../../../../../lib/inspect-base-command');

class RequestLogsCommand extends InspectBaseCommand {
  async run() {
    const { args, flags } = await this.parse(RequestLogsCommand);
    try {
      if (!args.id) {
        const params = {};
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getRequestLogs(flags.target, params)
        );
        if (response?.status === 200) {
          const json = await response.json();
          if (flags.output === 'json') {
            logInJsonArrayFormat(json?.items);
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getRequestLog(flags.target, args.id)
        );
        if (response?.status === 200) {
          const requestLog = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(requestLog, null, 2));
          } else {
            logInTableFormat([requestLog]);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

/**
 * @param {object} items - The items selectively displayed in the table.
 */
function logInTableFormat(items) {
  cli.table(
    items,
    {
      id: {
        header: 'ID',
        minWidth: 20,
      },
      method: {
        minWidth: 7,
      },
      path: {
        minWidth: 7,
      },
    },
    { printLine: (s) => cli.log(s) }
  );
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
    include: inspectCommonFlags.include,
    output: inspectCommonFlags.output,
  },
});

module.exports = RequestLogsCommand;

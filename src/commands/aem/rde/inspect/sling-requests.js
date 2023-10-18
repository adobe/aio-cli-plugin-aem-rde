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

const { cli } = require('../../../../lib/base-command');
const {
  inspectCommonFlags,
  InspectBaseCommand,
  logInJsonArrayFormat,
} = require('../../../../lib/inspect-base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');

class SlingRequestsCommand extends InspectBaseCommand {
  async run() {
    const { args, flags } = await this.parse(SlingRequestsCommand);
    try {
      if (!args.id) {
        const params = {};
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSlingRequests(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.output === 'json') {
            logInJsonArrayFormat(json?.items);
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({ messageValues: [response.status, response.statusText] });
        }
      } else {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSlingRequest(flags.target, args.id)
        );

        if (response.status === 200) {
          const slingRequest = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(slingRequest, null, 2));
          } else {
            logInTableFormat([slingRequest]);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({ messageValues: [response.status, response.statusText] });
        }
      }
    } catch (err) {
      throw new internalCodes.INTERNAL_GET_SLING_REQUESTS_ERROR({ messageValues: err });
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
        minWidth: 7,
      },
      userId: {
        header: 'User ID',
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
    target: inspectCommonFlags.target,
    include: inspectCommonFlags.include,
    output: inspectCommonFlags.output,
  },
});

module.exports = SlingRequestsCommand;

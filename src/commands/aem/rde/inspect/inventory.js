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
  logInJsonArrayFormat,
  InspectBaseCommand,
  inspectCommonFlags,
} = require('../../../../lib/inspect-base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');

class InventoryCommand extends InspectBaseCommand {
  async run() {
    const { args, flags } = await this.parse(InventoryCommand);
    try {
      if (!args.id) {
        const params = {};
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getInventories(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.output === 'json') {
            logInJsonArrayFormat(json.items);
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      } else {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getInventory(flags.target, args.id)
        );
        if (response.status === 200) {
          const inventory = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(inventory, null, 2));
          } else {
            logInTableFormat([inventory]);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      }
    } catch (err) {
      throwAioError(err, new internalCodes.INTERNAL_INVENTORY_ERROR({ messageValues: err }));
    }
  }
}

/**
 * @param {object} items - The items displayed as a JSON array.
 */
function logInTableFormat(items) {
  cli.table(
    items,
    {
      format: {
        minWidth: 7,
      },
      id: {
        header: 'ID',
        minWidth: 20,
      },
    },
    { printLine: (s) => cli.log(s) }
  );
}

Object.assign(InventoryCommand, {
  description:
    'Get the list of inventories for the target of a rapid development environment.',
  args: [
    {
      name: 'id',
      description: 'The id of the inventory to get.',
    },
  ],
  flags: {
    target: inspectCommonFlags.target,
    include: inspectCommonFlags.include,
    output: inspectCommonFlags.output,
  },
});

module.exports = InventoryCommand;

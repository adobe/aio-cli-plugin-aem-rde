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
  cli,
  BaseCommand,
  commonFlags,
} = require('../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');

class InventoryCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      if (!args.id) {
        const params = {};
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getInventories(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.json) {
            this.logInJsonArrayFormat(json.items);
          } else {
            this.logInTableFormat(json?.items);
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
          if (flags.json) {
            this.doLog(JSON.stringify(inventory, null, 2), true);
          } else {
            this.logInTableFormat([inventory]);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_INVENTORY_ERROR({ messageValues: err })
      );
    }
  }

  /**
   * @param {object} items - The items displayed as a JSON array.
   */
  logInTableFormat(items) {
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
      { printLine: (s) => this.doLog(s, true) }
    );
  }
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
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    include: commonFlags.include,
    quiet: commonFlags.quiet,
  },
});

module.exports = InventoryCommand;

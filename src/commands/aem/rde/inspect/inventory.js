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
  logInJsonArrayFormat,
} = require('../../../../lib/base-command');

class InventoryCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(InventoryCommand);
    try {
      if (!args.id) {
        let params = {};
        params.filter = flags.include;

        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getInventories(flags.target, params)
        );
        if (response.status === 200) {
          let json = await response.json();
          if (flags.output == 'json') {
            logInJsonArrayFormat(json?.items);
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getInventory(flags.target, args.id)
        );
        if (response.status === 200) {
          let inventory = await response.json();
          if (flags.output == 'json') {
            cli.log(JSON.stringify(inventory, null, 2));
          } else {
            logInTableFormat([inventory]);
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

function logInTableFormat(items) {
  cli.table(items, {
    format: {
      minWidth: 7,
    },
    id: {
      header: 'ID',
      minWidth: 20,
    },
  });
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
    target: commonFlags.target,
    include: commonFlags.include,
    output: commonFlags.output,
  },
});

module.exports = InventoryCommand;

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

class OsgiServicesCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(OsgiServicesCommand);
    try {
      if (!args.id) {
        const params = {};
        params.scope = flags.scope;
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiServices(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(json.items));
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiService(flags.target, args.id)
        );

        if (response.status === 200) {
          const osgiService = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(osgiService, null, 2));
          } else {
            logInTableFormat([osgiService]);
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
 * @param items
 */
function logInTableFormat(items) {
  cli.table(items, {
    id: {
      header: 'ID',
    },
    scope: {
      minWidth: 7,
    },
    bundleId: {
      header: 'Bundle ID',
      minWidth: 7,
    },
    types: {
      minWidth: 7,
    },
  });
}

Object.assign(OsgiServicesCommand, {
  description:
    'Get the list of osgi-services for the target of a rapid development environment.',
  args: [
    {
      name: 'id',
      description: 'The id of the osgi-service to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
    scope: commonFlags.scope,
    include: commonFlags.include,
    output: commonFlags.output,
  },
});

module.exports = OsgiServicesCommand;

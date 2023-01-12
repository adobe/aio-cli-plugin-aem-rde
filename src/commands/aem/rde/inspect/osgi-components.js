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

class OsgiComponentsCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(OsgiComponentsCommand);
    try {
      if (!args.name) {
        const params = {};
        params.scope = flags.scope;
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiComponents(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(json?.items));
          } else {
            logInTableFormat(json?.items);
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiComponent(flags.target, args.name)
        );
        if (response.status === 200) {
          const osgiComponent = await response.json();
          if (flags.output === 'json') {
            cli.log(JSON.stringify(osgiComponent, null, 2));
          } else {
            logInTableFormat([osgiComponent]);
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
    name: {
      header: 'NAME',
      minWidth: 25,
    },
    bundleId: {
      header: 'Bundle ID',
    },
    scope: {
      minWidth: 7,
    },
    immediate: {
      minWidth: 7,
    },
    implementationClass: {
      header: 'Implementation Class',
    },
  });
}

Object.assign(OsgiComponentsCommand, {
  description:
    'Get the list of osgi-components for the target of a rapid development environment.',
  args: [
    {
      name: 'name',
      description: 'The name of the osgi-component to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
    scope: commonFlags.scope,
    include: commonFlags.include,
    output: commonFlags.output,
  },
});

module.exports = OsgiComponentsCommand;

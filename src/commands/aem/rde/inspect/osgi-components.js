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
  InspectBaseCommand,
  inspectCommonFlags,
} = require('../../../../lib/inspect-base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { AioError } = require('../../../../lib/errors');

class OsgiComponentsCommand extends InspectBaseCommand {
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
          throw new internalCodes.UNEXPECTED_API_ERROR({ messageValues: [response.status, response.statusText] });
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
          throw new internalCodes.UNEXPECTED_API_ERROR({ messageValues: [response.status, response.statusText] });
        }
      }
    } catch (err) {
      if (err instanceof AioError) {
        throw err;
      }
      throw new internalCodes.INTERNAL_GET_OSGI_COMPONENTS_ERROR({ messageValues: err });
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
    },
    { printLine: (s) => cli.log(s) }
  );
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
    target: inspectCommonFlags.target,
    scope: inspectCommonFlags.scope,
    include: inspectCommonFlags.include,
    output: inspectCommonFlags.output,
  },
});

module.exports = OsgiComponentsCommand;

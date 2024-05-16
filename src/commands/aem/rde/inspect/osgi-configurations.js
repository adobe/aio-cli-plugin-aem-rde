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

class OsgiConfigurationsCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      if (!args.pId) {
        const params = {};
        params.scope = flags.scope;
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiConfigurations(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.json) {
            cli.log(JSON.stringify(json?.items));
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
          cloudSdkAPI.getOsgiConfiguration(flags.target, args.pId)
        );
        if (response.status === 200) {
          const osgiConfiguration = await response.json();
          if (flags.json) {
            cli.log(JSON.stringify(osgiConfiguration, null, 2));
          } else {
            logInTableFormat([osgiConfiguration]);
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
        new internalCodes.INTERNAL_GET_OSGI_CONFIGURATIONS_ERROR({
          messageValues: err,
        })
      );
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
      pid: {
        header: 'PID',
      },
    },
    { printLine: (s) => cli.log(s) }
  );
}

Object.assign(OsgiConfigurationsCommand, {
  description:
    'Get the list of osgi-configurations for the target of a rapid development environment.',
  args: [
    {
      name: 'pId',
      description: 'The PID of the osgi-configuration to get.',
    },
  ],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    scope: commonFlags.scope,
    include: commonFlags.include,
    json: commonFlags.json,
    quiet: commonFlags.quiet,
  },
});

module.exports = OsgiConfigurationsCommand;

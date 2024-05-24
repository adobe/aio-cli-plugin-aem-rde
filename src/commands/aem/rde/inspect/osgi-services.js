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

class OsgiServicesCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      const result = this.jsonResult();
      if (!args.id) {
        const params = {};
        params.scope = flags.scope;
        params.filter = flags.include;

        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiServices(flags.target, params)
        );
        if (response.status === 200) {
          const json = await response.json();
          if (flags.json) {
            result.items = json?.items;
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
          cloudSdkAPI.getOsgiService(flags.target, args.id)
        );

        if (response.status === 200) {
          const osgiService = await response.json();
          if (flags.json) {
            result.items = osgiService;
          } else {
            this.logInTableFormat([osgiService]);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      }
      if (flags.json) {
        return result;
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_GET_OSGI_SERVICES_ERROR({
          messageValues: err,
        })
      );
    }
  }

  /**
   * @param {object} items - The items selectively displayed in the table.
   */
  logInTableFormat(items) {
    cli.table(
      items,
      {
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
      },
      { printLine: (s) => this.doLog(s, true) }
    );
  }
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
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    scope: commonFlags.scope,
    include: commonFlags.include,
    quiet: commonFlags.quiet,
  },
});

module.exports = OsgiServicesCommand;

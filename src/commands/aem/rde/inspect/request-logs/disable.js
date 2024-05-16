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

const { BaseCommand, commonFlags } = require('../../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../../lib/internal-errors');
const { throwAioError } = require('../../../../../lib/error-helpers');

class DisableRequestLogsCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.disableRequestLogs(flags.target)
      );
      if (response.status === 200) {
        this.doLog('Request-logs disabled.');
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_REQUEST_LOGS_DISABLE_ERROR({
          messageValues: err,
        })
      );
    }
  }
}

Object.assign(DisableRequestLogsCommand, {
  description: 'Disable request logging.',
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    quiet: commonFlags.quiet,
  },
});

module.exports = DisableRequestLogsCommand;

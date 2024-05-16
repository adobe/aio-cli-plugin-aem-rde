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
  Flags,
  commonFlags,
} = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');

class ResetCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      this.doLog(`Reset cm-p${this._programId}-e${this._environmentId}`);
      this.spinnerStart('resetting environment');
      await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.resetEnv(flags.wait)
      );
      this.spinnerStop();
      if (flags.wait) {
        this.doLog(`Environment reset.`);
      } else {
        this.doLog(
          `Not waiting to finish reset. Check using status command for progress. It may take a couple of seconds to indicate 'Deployment in progress'.`
        );
      }
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_RESET_ERROR({ messageValues: err })
      );
    }
  }
}

Object.assign(ResetCommand, {
  description: 'Reset the RDE',
  args: [],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    wait: Flags.boolean({
      description:
        'Do or do not wait for completion of the reset operation. Progress can be manually checked using the "status" command.',
      multiple: false,
      required: false,
      default: true,
      allowNo: true,
    }),
    quiet: commonFlags.quiet,
  },
  aliases: [],
});

module.exports = ResetCommand;

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

const { BaseCommand, cli, Flags, commonFlags } = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');

class ResetCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      this.spinnerStart('resetting environment');
      await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.resetEnv(flags.nowait)
      );
      this.spinnerStop();
      if (flags.nowait) {
        cli.log(
          `Not waiting to finish reset. Check using status command for progress. It may take a couple of seconds to indicate 'Deployment in progress'.`
        );
      } else {
        cli.log(`Environment reset.`);
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
    cicd: commonFlags.cicd,
    nowait: Flags.boolean({
      description:
        'Do not wait for the environment to be reset. Check using status command for progress.',
      multiple: false,
      required: false,
      default: false,
    }),
  },
  aliases: [],
});

module.exports = ResetCommand;

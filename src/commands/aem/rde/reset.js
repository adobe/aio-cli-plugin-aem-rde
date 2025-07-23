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
      const result = this.jsonResult();
      this.doLog(`Reset cm-p${this._programId}-e${this._environmentId}`);
      this.spinnerStart(
        'resetting environment ...  ' +
          flags['keep-mutable-content'] +
          ' ' +
          flags.force
      );
      const status = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.resetEnv(
          flags.wait,
          flags['keep-mutable-content'],
          flags.force
        )
      );
      this.spinnerStop();
      if (flags.wait) {
        if (status === 'ready') {
          result.status = 'reset';
          this.doLog(`Environment reset.`);
          this.notify('reset', 'RDE environment is reset.');
        } else if (status === 'reset_failed') {
          result.status = 'reset_failed';
          this.doLog(`Failed to reset the environment.`);
          this.notify('reset failed', 'RDE environment failed to reset.');
        }
      } else {
        result.status = 'resetting';
        this.doLog(
          `Not waiting to finish reset. Check using status command for progress. It may take a couple of seconds to indicate 'Deployment in progress'.`
        );
      }
      return result;
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
    'keep-mutable-content': Flags.boolean({
      description: 'Reset the RDE but keep mutable content.',
      required: false,
      default: false,
      multiple: false,
    }),
    force: Flags.boolean({
      char: 'f',
      multiple: false,
      required: false,
      default: false,
      description:
        'Force resets the RDE, not re-using a previously generated base repository. Can be used in case of issues but takes longer.',
    }),
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

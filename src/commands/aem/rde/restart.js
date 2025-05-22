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

const { BaseCommand, commonFlags } = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');

class RestartCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      const result = this.jsonResult();
      this.doLog(`Restart cm-p${this._programId}-e${this._environmentId}`);
      this.spinnerStart('restarting environment');
      await this.withCloudSdk((cloudSdkAPI) => cloudSdkAPI.restartEnv());
      this.spinnerStop();
      result.status = 'restarted';
      this.doLog(`Environment restarted.`);
      this.notify('restarted', 'RDE environment is restarted.');
      return result;
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_RESTART_ERROR({ messageValues: err })
      );
    }
  }
}

Object.assign(RestartCommand, {
  description: 'Restart the author and publish of an RDE',
  args: [],
  aliases: [],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    quiet: commonFlags.quiet,
  },
});

module.exports = RestartCommand;

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

const { BaseCommand, cli, commonFlags } = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const spinner = require('ora')();

class RestartCommand extends BaseCommand {
  async run() {
    const { flags } = await this.parse(RestartCommand);
    try {
      cli.log(
        `Restart cm-p${this.getProgramId(flags)}-e${this.getEnvironmentId(
          flags
        )}`
      );
      spinner.start('restarting environment');
      await this.withCloudSdk(flags, (cloudSdkAPI) => cloudSdkAPI.restartEnv());
      spinner.stop();
      cli.log(`Environment restarted.`);
    } catch (err) {
      spinner.stop();
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
    ...commonFlags.global,
  },
});

module.exports = RestartCommand;

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

const { BaseCommand, Flags } = require('../../../lib/base-command');
const {
  codes: configurationCodes,
} = require('../../../lib/configuration-errors');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const chalk = require('chalk');

class CleanEnvrionment extends BaseCommand {
  async runCommand(args, flags) {
    let response;
    try {
      this.spinnerStart(`Cleaning the rde...`);
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.cleanEnv(args.name, flags['drop-content'])
      );
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_CLEAN_ERROR({ messageValues: err })
      );
    }
    this.spinnerStop();
    if (response?.status === 200) {
      this.doLog(
        chalk.green(
          `RDE cleaned sucessfully. Use 'aio aem rde status' to view the updated state.`
        )
      );
    } else if (response?.status === 400) {
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
    } else if (response?.status === 406) {
      throw new internalCodes.INVALID_STATE();
    } else {
      throw new internalCodes.UNKNOWN();
    }
  }
}

Object.assign(CleanEnvrionment, {
  description: 'Old aliases',
  aliases: ['aem:rde:suuber'],
  deprecateAliases: true,
});

Object.assign(CleanEnvrionment, {
  description:
    'Removes the deployment and upgrades to latest AEM version while keeping the content. Gives an option to delete the content.',
  args: [],
  aliases: [],
  flags: {
    'drop-content': Flags.boolean({
      description: 'Also delete the content of the environment.',
      char: 'd',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = CleanEnvrionment;

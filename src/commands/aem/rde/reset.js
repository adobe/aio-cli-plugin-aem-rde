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
const spinner = require('ora')();

class ResetCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(ResetCommand);
    try {
      spinner.start('resetting environment');
      await this.withCloudSdk(flags, (cloudSdkAPI) => {
        cli.log(`Reset ${cloudSdkAPI.getEnvironmentLabel()}`);
        cloudSdkAPI.resetEnv();
      });
      spinner.stop();
      cli.log(`Environment reset.`);
    } catch (err) {
      spinner.stop();
      cli.log(err);
    }
  }
}

Object.assign(ResetCommand, {
  description: 'Reset the RDE',
  args: [],
  flags: {
    ...commonFlags.global,
  },
  aliases: [],
});

module.exports = ResetCommand;

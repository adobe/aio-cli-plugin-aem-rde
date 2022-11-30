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
  cli,
  commonFlags,
} = require('../../../../lib/base-command');

class DisableRequestLogsCommand extends BaseCommand {
  async run() {
    const { flags } = await this.parse(DisableRequestLogsCommand);
    try {
      let response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.disableRequestLogs(flags.target)
      );
      if (response.status === 200) {
        cli.log('Request-logs disabled.');
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(DisableRequestLogsCommand, {
  description: 'Disable request logging.',
  flags: {
    target: commonFlags.target,
  },
});

module.exports = DisableRequestLogsCommand;

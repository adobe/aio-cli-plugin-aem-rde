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
} = require('../../../../../lib/base-command');

class DeleteLogsCommand extends BaseCommand {
  async run() {
    const { argv, flags } = await this.parse(DeleteLogsCommand);
    try {
      argv.forEach(async (id) => {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.deleteAemLog(flags.target, id)
        );
        if (response.status === 200) {
          cli.log(`Successfully deleted log ${id}`);
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      });
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(DeleteLogsCommand, {
  description:
    'Delete the log for the service of a rapid development environment.',
  strict: false,
  args: [
    {
      name: 'id',
      description: 'The id of the log to delete.',
      required: true,
    },
  ],
  flags: {
    target: commonFlags.target,
  },
});

module.exports = DeleteLogsCommand;

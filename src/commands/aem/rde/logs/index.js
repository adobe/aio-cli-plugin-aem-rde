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
  Flags,
  commonFlags,
} = require('../../../../lib/base-command');

class LogsCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(LogsCommand);
    try {
      if (!args.id) {
        let params = {};
        params.filter = flags.include;

        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getAemLogs(flags.target, params)
        );
        if (response.status === 200) {
          let json = await response.json();

          if (json.items?.length === 0) {
            cli.log('Logs are empty.');
          } else {
            cli.log('- Logs: ');
            json.items.forEach((aemLogs) => {
              cli.log(aemLogs);
            });
          }
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        let response;
        if (!flags.tail) {
          response = await this.withCloudSdk((cloudSdkAPI) =>
            cloudSdkAPI.getAemLog(flags.target, args.id)
          );
          if (response.status === 200) {
            let aemLog = await response.json();
            cli.log(`- Log "${args.id}": `);
            cli.log(aemLog);
          } else {
            cli.log(`Error: ${response.status} - ${response.statusText}`);
          }
        } else {
          response = await this.withCloudSdk((cloudSdkAPI) =>
            cloudSdkAPI.getAemLogTail(flags.target, args.id)
          );
          if (response.status === 200) {
            let aemLogTail = await response.text();
            cli.log(`- Logtail from log: "${args.id}": `);
            cli.log(aemLogTail);
          } else {
            cli.log(`Error: ${response.status} - ${response.statusText}`);
          }
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(LogsCommand, {
  description:
    'Get the list of logs for the target of a rapid development environment.',
  args: [
    {
      name: 'id',
      description: 'The id of the log to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
    tail: Flags.boolean({
      char: 't',
      description: 'Tail the log and get the current log output.',
      multiple: false,
      required: false,
    }),
    include: commonFlags.include,
    // TODO: need to be implement
    forward: Flags.boolean({
      char: 'f',
      description: 'Tail the log and get the current log output continuously.',
      multiple: false,
      required: false,
    }),
  },
});

module.exports = LogsCommand;

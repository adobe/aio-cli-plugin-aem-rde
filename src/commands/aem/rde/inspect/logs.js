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

const { cli, Flags, commonFlags } = require('../../../../lib/base-command');
const { InspectBaseCommand } = require('../../../../lib/inspect-base-command');

class LogsCommand extends InspectBaseCommand {
  async run() {
    const { flags } = await this.parse(LogsCommand);
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.getAemLogs(flags.target, {})
      );

      if (response.status === 200) {
        const json = await response.json();

        if (json.items?.length >= 3) {
          await this.deleteLog(flags.target, json.items[0].id);
        }
        const newLog = await this.createLog(flags);
        const intervalId = setInterval(() => {
          this.printLogTail(flags.target, newLog.id);
        }, 1500);

        // `ctl c` stops displaying the logs
        let listener = () => {
          clearInterval(intervalId);
          this.deleteLog(flags.target, json.items.at(-1)?.id);
        };
        process.once('SIGTERM', listener);
        process.once('SIGINT', listener);
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      cli.log(err);
    }
  }

  async deleteLog(target, id) {
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.deleteAemLog(target, id)
      );
      if (response.status !== 200) {
        cli.log(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      cli.log(err);
    }
  }

  async createLog(flags) {
    try {
      // build a request body out of the received flags
      const body = {};
      if (flags.format) {
        body.format = flags.format;
      }
      // check if there are values for the name key
      if (flags.info || flags.debug || flags.warn || flags.error) {
        const namesArray = [];
        flags?.info?.forEach((logger) => {
          namesArray.push({ logger, level: 'INFO' });
        });
        flags?.debug?.forEach((logger) => {
          namesArray.push({ logger, level: 'DEBUG' });
        });
        flags?.warn?.forEach((logger) => {
          namesArray.push({ logger, level: 'WARN' });
        });
        flags?.error?.forEach((logger) => {
          namesArray.push({ logger, level: 'ERROR' });
        });
        body.names = namesArray;
      }

      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.createAemLog(flags.target, body)
      );

      if (response.status === 201) {
        const log = await response.json();
        return log;
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      cli.log(err);
    }
  }

  async printLogTail(target, id) {
    const response = await this.withCloudSdk((cloudSdkAPI) =>
      cloudSdkAPI.getAemLogTail(target, id)
    );
    if (response.status === 200) {
      const aemLogTail = await response.text();
      if (aemLogTail) {
        cli.log(aemLogTail.trim());
      }
    } else {
      cli.log(`Error: ${response.status} - ${response.statusText}`);
    }
  }
}

Object.assign(LogsCommand, {
  description:
    'Get the list of logs for the target of a rapid development environment.',
  flags: {
    target: commonFlags.target,
    format: Flags.string({
      char: 'f',
      description: `Specify the format string. eg: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n`,
      multiple: false,
      required: false,
    }),
    info: Flags.string({
      char: 'i',
      description: `Optional logger on INFO level.`,
      multiple: true,
      required: false,
    }),
    debug: Flags.string({
      char: 'd',
      description: `Optional logger on DEBUG level.`,
      multiple: true,
      required: false,
    }),
    warn: Flags.string({
      char: 'w',
      description: `Optional logger on WARN level.`,
      multiple: true,
      required: false,
    }),
    error: Flags.string({
      char: 'e',
      description: `Optional logger on ERROR level.`,
      multiple: true,
      required: false,
    }),
  },
});

module.exports = LogsCommand;

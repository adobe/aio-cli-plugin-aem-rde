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

const { cli, Flags } = require('../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const {
  InspectBaseCommand,
  inspectCommonFlags,
} = require('../../../../lib/inspect-base-command');

class LogsCommand extends InspectBaseCommand {
  async run() {
    const { flags } = await this.parse(LogsCommand);
    this.flags = flags || {};
    try {
      const response = await this.withCloudSdk(this.flags, (cloudSdkAPI) =>
        cloudSdkAPI.getAemLogs(flags.target, {})
      );

      if (response.status === 200) {
        const json = await response.json();

        // The log amount is limited to 3
        if (json.items?.length >= 3) {
          await this.deleteLog(flags.target, json.items[0].id);
        }
        const newLog = await this.createLog(flags);

        // The logs are displayed continuously until they are cancelled with `ctl c`.
        this.intervalId = setInterval(async () => {
          await this.printLogTail(flags.target, newLog.id);
        }, 1500);

        this.lastItemId = json.items?.at(-1)?.id;

        // `ctl c` stops displaying the logs
        process.removeListener('SIGINT', this.stopAndCleanup);
        process.removeListener('SIGTERM', this.stopAndCleanup);
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_GET_LOG_ERROR({ messageValues: err })
      );
    }
  }

  async stopAndCleanup() {
    if (!this.stopped) {
      this.stopped = true;
      process.removeListener('SIGINT', () => this.stopAndCleanup());
      process.removeListener('SIGTERM', () => this.stopAndCleanup());
      clearInterval(this.intervalId);
      await this.deleteLog(this.flags.target, this.lastItemId);
    }
  }

  async deleteLog(target, id) {
    try {
      const response = await this.withCloudSdk(this.flags, (cloudSdkAPI) =>
        cloudSdkAPI.deleteAemLog(target, id)
      );
      if (response.status !== 200) {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throw new internalCodes.INTERNAL_DELETE_LOG_ERROR({ messageValues: err });
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
      // formats the flags in the right way to pass them to the request
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

      const response = await this.withCloudSdk(this.flags, (cloudSdkAPI) =>
        cloudSdkAPI.createAemLog(flags.target, body)
      );

      if (response.status === 201) {
        const log = await response.json();
        return log;
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throw new internalCodes.INTERNAL_CREATE_LOG_ERROR({ messageValues: err });
    }
  }

  async printLogTail(target, id) {
    const response = await this.withCloudSdk(this.flags, (cloudSdkAPI) =>
      cloudSdkAPI.getAemLogTail(target, id)
    );
    if (response.status === 200) {
      const aemLogTail = await response.text();
      if (aemLogTail) {
        cli.log(aemLogTail.trim());
      }
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
    }
  }
}

Object.assign(LogsCommand, {
  description:
    'Get the list of logs for the target of a rapid development environment.',
  flags: {
    ...inspectCommonFlags.global,
    target: inspectCommonFlags.target,
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

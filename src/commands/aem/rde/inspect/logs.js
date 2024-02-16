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
const chalk = require('chalk');
const { sleepMillis } = require('../../../../lib/utils');

const REQUEST_INTERVAL_MS = 500;
const LOG_COLORS = {
  '*TRACE*': chalk.blackBright,
  '*DEBUG*': chalk.cyan,
  '*INFO*': chalk.green,
  '*WARN*': chalk.yellow,
  '*ERROR*': chalk.red,
};

class LogsCommand extends InspectBaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.stopAndCleanupCallback = this.stopAndCleanup.bind(this);
  }

  async run() {
    const { flags } = await this.parse(LogsCommand);
    this.flags = flags || {};
    let error;
    try {
      let [log] = await this.createLog(flags);
      if (log === undefined) {
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getAemLogs(this.flags.target, {})
        );
        if (response.status === 200) {
          const json = await response.json();
          // The log amount is limited to 3
          if (json.items?.length >= 3) {
            await this.deleteLog(flags.target, json.items[0].id);
          }
          [log, error] = await this.createLog(flags);
        } else {
          error = new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      }
      if (error === undefined && log?.id) {
        this.lastItemId = log.id;
        process.addListener('SIGINT', this.stopAndCleanupCallback);
        process.addListener('SIGTERM', this.stopAndCleanupCallback);
        // The logs are displayed continuously until they are cancelled with `ctl c`.
        this.intervalId = setInterval(() => {
          if (!this.stopped) {
            this.printLogTail(log.id, flags.target, flags.color);
          }
        }, REQUEST_INTERVAL_MS);
      }
    } catch (err) {
      await this.stopAndCleanup();
      throwAioError(
        err,
        new internalCodes.INTERNAL_GET_LOG_ERROR({ messageValues: err })
      );
    }

    if (error) {
      await this.stopAndCleanup();
      throw error;
    }
  }

  async stopAndCleanup() {
    if (!this.stopped) {
      this.stopped = true;
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }

      process.removeListener('SIGINT', this.stopAndCleanupCallback);
      process.removeListener('SIGTERM', this.stopAndCleanupCallback);
      if (this.lastItemId !== undefined) {
        await this.deleteLog(this.flags.target, this.lastItemId);
      }
    }
  }

  async deleteLog(target, id) {
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
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
        // flags?.trace?.forEach((logger) => {
        //   namesArray.push({ logger, level: 'TRACE' });
        // });
        flags?.debug?.forEach((logger) => {
          namesArray.push({ logger, level: 'DEBUG' });
        });
        flags?.info?.forEach((logger) => {
          namesArray.push({ logger, level: 'INFO' });
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
        return [log, undefined];
      } else {
        return [
          undefined,
          new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          }),
        ];
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_CREATE_LOG_ERROR({ messageValues: err })
      );
    }
  }

  async printLogTail(id, target, colorize) {
    const response = await this.withCloudSdk((cloudSdkAPI) =>
      cloudSdkAPI.getAemLogTail(target, id)
    );

    if (response.status === 200) {
      const aemLogTail = await response.text();
      const logLines =
        aemLogTail
          .trim()
          .split(/[\r\n]{1,2}/)
          .filter((s) => s !== '') || [];

      // A small delay between the log lines makes the tail
      // feel more fluid. It counter-acts the feeling of getting
      // big chunks of log due to log polling.
      const perLineDelay = Math.max(
        1,
        Math.min(
          Math.floor(REQUEST_INTERVAL_MS / logLines.length),
          REQUEST_INTERVAL_MS
        )
      );
      for (let i = 0; i < logLines.length && !this.stopped; i++) {
        const line = colorize ? this.colorizeLine(logLines[i]) : logLines[i];
        cli.log(line);
        await sleepMillis(perLineDelay);
      }
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
    }
  }

  colorizeLine(line) {
    for (const level in LOG_COLORS) {
      if (line.includes(level)) {
        return LOG_COLORS[level](line);
      }
    }
    return line;
  }
}

Object.assign(LogsCommand, {
  description:
    'Get the list of logs for the target of a rapid development environment.',
  flags: {
    target: inspectCommonFlags.target,
    format: Flags.string({
      char: 'f',
      description: `Specify the format string. eg: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n`,
      multiple: false,
      required: false,
    }),
    // trace: Flags.string({
    //   description: `Optional logger on TRACE level.`,
    //   multiple: true,
    //   required: false,
    // }),
    debug: Flags.string({
      char: 'd',
      description: `Optional logger on DEBUG level.`,
      multiple: true,
      required: false,
    }),
    info: Flags.string({
      char: 'i',
      description: `Optional logger on INFO level.`,
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
    color: Flags.boolean({
      aliases: ['colour'],
      description: 'Colorize log output',
      default: true,
      allowNo: true,
    }),
  },
});

module.exports = LogsCommand;

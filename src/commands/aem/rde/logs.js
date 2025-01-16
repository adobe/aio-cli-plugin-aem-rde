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

const { Flags } = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const { BaseCommand, commonFlags } = require('../../../lib/base-command');
const chalk = require('chalk');
const { sleepMillis } = require('../../../lib/utils');
const inquirer = require('inquirer');

const REQUEST_INTERVAL_MS = 500;
const LOG_COLORS = {
  '*TRACE*': chalk.blackBright,
  '*DEBUG*': chalk.cyan,
  '*INFO*': chalk.green,
  '*WARN*': chalk.yellow,
  '*ERROR*': chalk.red,
};

const HIGHLIGHT_COLOR = chalk.white;

class LogsCommand extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.stopAndCleanupCallback = this.stopAndCleanup.bind(this);
  }

  async runCommand(args, flags) {
    this.flags = flags || {};
    try {
      let log;
      if (flags.choose) {
        log = await this.chooseLogConfiguration(flags, false);
      } else {
        log = await this.createOrRemoveLog(flags);
      }
      if (log?.id) {
        this.lastItemId = log.id;
        process.addListener('SIGINT', this.stopAndCleanupCallback);
        process.addListener('SIGTERM', this.stopAndCleanupCallback);
        // The logs are displayed continuously until they are cancelled with `ctl c`.

        flags.highlight?.forEach((h) => {
          LOG_COLORS[h] = HIGHLIGHT_COLOR;
        });

        this.intervalId = setInterval(() => {
          if (!this.stopped) {
            this.printLogTail(log.id, flags.target, flags.color);
          }
        }, REQUEST_INTERVAL_MS);
      } else {
        this.doLog('No active log configuration found.');
      }
    } catch (err) {
      await this.stopAndCleanup();
      throwAioError(
        err,
        new internalCodes.INTERNAL_GET_LOG_ERROR({ messageValues: err })
      );
    }
  }

  async createOrRemoveLog(flags) {
    try {
      return await this.createLog(flags);
    } catch (err) {
      if (err.code === 'INTERNAL_CREATE_LOG_TOO_MANY_LOGS_ERROR') {
        await this.removeLogUserPrompt(flags);
        return await this.createOrRemoveLog(flags);
      }
      throw err;
    }
  }

  async removeLogUserPrompt(flags) {
    const log = await this.chooseLogConfiguration(flags, true);
    await this.deleteLog(flags.target, log.id);
  }

  async chooseLogConfiguration(flags, tooManyLogs) {
    const response = await this.withCloudSdk((cloudSdkAPI) =>
      cloudSdkAPI.getAemLogs(this.flags?.target, {})
    );
    if (response.status === 200) {
      inquirer.registerPrompt(
        'autocomplete',
        require('inquirer-autocomplete-prompt')
      );

      const json = await response.json();

      let logChoices = json?.items?.map(({ id, names }) => ({
        name: `${names.map((n) => `${n.logger}:${n.level}`).join(' ')}`,
        value: id,
      }));
      if (!logChoices) {
        logChoices = [];
      }

      const nrOfLogs = Object.keys(logChoices).length;
      if (nrOfLogs === 0) {
        return null;
      }
      logChoices.push({ name: 'cancel', value: 'cancel' });

      const msg = tooManyLogs
        ? 'Too many log configurations. Choose one to replace (type to filter):'
        : 'Choose a log configuration (type to filter):';
      const { logId } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'logId',
          message: msg,
          pageSize: 5,
          source: async (answersSoFar, input) => {
            input = input || '';
            return logChoices.filter((choice) =>
              choice.name.toLowerCase().includes(input.toLowerCase())
            );
          },
        },
      ]);
      if (logId === 'cancel') {
        // eslint-disable-next-line no-process-exit
        process.exit(0);
      }
      return json?.items.find((item) => item.id === logId);
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
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
        await this.deleteLog(this.flags?.target, this.lastItemId);
      }
    }
  }

  async deleteLog(target, id) {
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.deleteAemLog(target, id)
      );
      if (response.status === 404) {
        // the log that is desired to be deleted is not found, which is fine
      } else if (response.status !== 200) {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
      this.doLog('\nLog configuration removed.');
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
      if (
        flags.info ||
        flags.debug ||
        flags.warn ||
        flags.error ||
        flags.trace
      ) {
        const namesArray = [];
        flags?.trace?.forEach((logger) => {
          namesArray.push({ logger, level: 'TRACE' });
        });
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

      if (!body.names || body.names.length === 0) {
        this.doLog(chalk.yellow(`No log configuration provided.`));
        this.doLog(chalk.gray(`Default to: aio aem rde logs -i ""`));
        flags.info = [''];
      }

      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.createAemLog(flags.target, body)
      );

      if (response.status === 201) {
        const log = await response.json();
        return log;
      } else if (response.status === 405) {
        throw new internalCodes.INTERNAL_CREATE_LOG_TOO_MANY_LOGS_ERROR();
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
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
        this.doLog(line, true);
        await sleepMillis(perLineDelay);
      }
    } else if (response.status === 404) {
      this.doLog(
        'Log configuration not found any longer. It may has been removed by introducing another new log configuration.'
      );
      await this.stopAndCleanup();
    } else {
      throw new internalCodes.UNEXPECTED_API_ERROR({
        messageValues: [response.status, response.statusText],
      });
    }
  }

  colorizeLine(line) {
    const originalLine = line;
    for (const level in LOG_COLORS) {
      if (line.includes(level)) {
        line = LOG_COLORS[level](originalLine);
      }
    }
    return line;
  }
}

Object.assign(LogsCommand, {
  description: 'Do not support json putput for logs command.',
  enableJsonFlag: false,
});

Object.assign(LogsCommand, {
  description:
    'Get the list of logs for the target of a rapid development environment.',
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    format: Flags.string({
      char: 'f',
      description: `Specify the format string. eg: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n`,
      multiple: false,
      required: false,
      helpValue: `<logback format definition>`,
      helpGroup: 'format and color',
    }),
    trace: Flags.string({
      char: 't',
      description: `Optional logger on TRACE level.`,
      multiple: true,
      required: false,
      helpValue: `<package or class name>`,
      helpGroup: 'level',
    }),
    debug: Flags.string({
      char: 'd',
      description: `Optional logger on DEBUG level.`,
      multiple: true,
      required: false,
      helpValue: `<package or class name>`,
      helpGroup: 'level',
    }),
    info: Flags.string({
      char: 'i',
      description: `Optional logger on INFO level.`,
      multiple: true,
      required: false,
      helpValue: `<package or class name>`,
      helpGroup: 'level',
    }),
    warn: Flags.string({
      char: 'w',
      description: `Optional logger on WARN level.`,
      multiple: true,
      required: false,
      helpValue: `<package or class name>`,
      helpGroup: 'level',
    }),
    error: Flags.string({
      char: 'e',
      description: `Optional logger on ERROR level.`,
      multiple: true,
      required: false,
      helpValue: `<package or class name>`,
      helpGroup: 'level',
    }),
    color: Flags.boolean({
      aliases: ['colour'],
      description: 'Colorize log output',
      default: true,
      allowNo: true,
      helpGroup: 'format and color',
    }),
    choose: Flags.boolean({
      description: 'Choose from existing log configurations to tail',
      default: false,
      helpGroup: 'output',
    }),
    highlight: Flags.string({
      char: 'H',
      description: `Highlight log lines containing the specified string.`,
      multiple: true,
      required: false,
      helpValue: `<substring of a log line>`,
      helpGroup: 'format and color',
    }),
    quiet: commonFlags.quiet,
  },
});

module.exports = LogsCommand;

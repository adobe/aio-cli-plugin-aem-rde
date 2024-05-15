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
  cli,
  Flags,
  BaseCommand,
  commonFlags,
} = require('../../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../../lib/internal-errors');
const { throwAioError } = require('../../../../../lib/error-helpers');

class EnableRequestLogsCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      // build a request body out of the received flags
      const body = {};

      if (flags.format) {
        body.format = flags.format;
      }
      if (flags.includePathPatterns) {
        const includePathPatternsArray = [];
        flags.includePathPatterns.forEach((pattern) => {
          includePathPatternsArray.push(pattern);
        });
        body.includePathPatterns = includePathPatternsArray;
      }
      // check if there are values for the name key
      // formats the flags in the right way to pass them to the request
      if (flags.info || flags.debug || flags.warn || flags.error) {
        const namesArray = [];
        flags.info?.forEach((logger) => {
          namesArray.push({ logger, level: 'INFO' });
        });
        flags.debug?.forEach((logger) => {
          namesArray.push({ logger, level: 'DEBUG' });
        });
        flags.warn?.forEach((logger) => {
          namesArray.push({ logger, level: 'WARN' });
        });
        flags.error?.forEach((logger) => {
          namesArray.push({ logger, level: 'ERROR' });
        });
        body.names = namesArray;
      }

      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.enableRequestLogs(flags.target, body)
      );

      if (response.status === 201) {
        cli.log('Request-logs enabled.');
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_REQUEST_LOGS_ENABLE_ERROR({
          messageValues: err,
        })
      );
    }
  }
}

Object.assign(EnableRequestLogsCommand, {
  description: 'Enable request logging or update the configuration.',
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    cicd: commonFlags.cicd,
    target: commonFlags.targetInspect,
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
    includePathPatterns: Flags.string({
      char: 'p',
      description:
        'The path of the incoming requests need to match at least one of the patterns (regular expressions).',
      multiple: true,
      required: false,
    }),
  },
});

module.exports = EnableRequestLogsCommand;

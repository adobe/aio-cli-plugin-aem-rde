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
} = require('../../../../../lib/base-command');

class EnableRequestLogsCommand extends BaseCommand {
  async run() {
    const { flags } = await this.parse(EnableRequestLogsCommand);
    try {
      // build a request body out of the received flags
      let body = {};

      if (flags.format) {
        body.format = flags.format;
      }
      if (flags.includePathPatterns) {
        let includePathPatternsArray = [];
        flags.includePathPatterns?.forEach((pattern) => {
          includePathPatternsArray.push(pattern);
        });
        body.includePathPatterns = includePathPatternsArray;
      }
      // check if there are values for the name key
      if (flags.info || flags.debug || flags.warn || flags.error) {
        let namesArray = [];
        flags.info?.forEach((logger) => {
          namesArray.push({ logger: logger, level: 'INFO' });
        });
        flags.debug?.forEach((logger) => {
          namesArray.push({ logger: logger, level: 'DEBUG' });
        });
        flags.warn?.forEach((logger) => {
          namesArray.push({ logger: logger, level: 'WARN' });
        });
        flags.error?.forEach((logger) => {
          namesArray.push({ logger: logger, level: 'ERROR' });
        });
        body.names = namesArray;
      }

      let response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.enableRequestLogs(flags.target, body)
      );

      if (response.status === 201) {
        let log = await response.json();
        cli.log('Request-logs enabled.');
      } else {
        cli.log(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(EnableRequestLogsCommand, {
  description: 'Enable request logging or update the configuration.',
  flags: {
    target: commonFlags.target,
    format: Flags.string({
      char: 'f',
      description: `Specify the format string. eg: '%d{dd.MM.yyyy HH:mm:ss.SSS} *%level* [%thread] %logger %msg%n'`,
      multiple: false,
      required: false,
    }),
    info: Flags.string({
      char: 'i',
      description: `Optional logger on INFO level.'`,
      multiple: true,
      required: false,
    }),
    debug: Flags.string({
      char: 'd',
      description: `Optional logger on DEBUG level.'`,
      multiple: true,
      required: false,
    }),
    warn: Flags.string({
      char: 'w',
      description: `Optional logger on WARN level.'`,
      multiple: true,
      required: false,
    }),
    error: Flags.string({
      char: 'e',
      description: `Optional logger on ERROR level.'`,
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

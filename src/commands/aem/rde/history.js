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

const { BaseCommand, cli } = require('../../../lib/base-command');
const rdeUtils = require('../../../lib/rde-utils');
const spinner = require('ora')();
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { codes: validationCodes } = require('../../../lib/validation-errors');
const { throwAioError } = require('../../../lib/error-helpers');

class HistoryCommand extends BaseCommand {
  async run() {
    const { args } = await this.parse(HistoryCommand);
    try {
      if (args.id === undefined) {
        spinner.start('fetching updates');
        const response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getChanges()
        );
        if (response.status === 200) {
          const json = await response.json();
          spinner.stop();
          if (json.items.length === 0) {
            cli.log('There are no updates yet.');
          } else {
            json.items.forEach(rdeUtils.logChange);
          }
        } else {
          throw new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [response.status, response.statusText],
          });
        }
      } else if (isNaN(args.id) || parseInt(args.id, 10) < 0) {
        throw new validationCodes.INVALID_UPDATE_ID({ messageValues: args.id });
      } else {
        await this.withCloudSdk((cloudSdkAPI) =>
          rdeUtils.loadUpdateHistory(cloudSdkAPI, args.id, cli, (done, text) =>
            done ? spinner.stop() : spinner.start(text)
          )
        );
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_HISTORY_ERROR({ messageValues: err })
      );
    } finally {
      spinner.stop();
    }
  }
}

Object.assign(HistoryCommand, {
  description: 'Get a list of the updates done to the current rde.',
  args: [
    {
      name: 'id',
      description: 'The id of the update to get (including logs)',
      multiple: false,
      required: false,
    },
  ],
  aliases: [],
});

module.exports = HistoryCommand;

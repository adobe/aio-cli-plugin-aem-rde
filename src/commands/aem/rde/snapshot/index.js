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

const { BaseCommand, Flags } = require('../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');

class ListSnapshots extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.programsCached = [];
    this.environmentsCached = [];
  }

  async runCommand(args, flags) {
    try {
      const result = this.jsonResult();
      this.spinnerStart('fetching snapshots');
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.getSnapshots()
      );
      if (response.status === 200) {
        const json = await response.json();
        result.status = json?.status;
        this.spinnerStop();
        if (json?.items?.length === 0) {
          this.doLog('There are no snapshots yet.');
        } else {
          result.items = json?.items;
          json?.items.forEach((e) => this.log(e));
        }
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
      return result;
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_HISTORY_ERROR({ messageValues: err })
      );
    } finally {
      this.spinnerStop();
    }
  }
}

Object.assign(ListSnapshots, {
  description:
    'Lists all content and deployment snapshots in your organization. Use --help for a list of subcommands.',
  args: [],
  aliases: [],
  flags: {
    usage: Flags.boolean({
      description: 'Sorts the snapshots by usage, most used first.',
      char: 'u',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = ListSnapshots;

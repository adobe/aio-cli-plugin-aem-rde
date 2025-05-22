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

const { BaseCommand, Flags, cli } = require('../../../../lib/base-command');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const {
  codes: configurationCodes,
} = require('../../../../lib/configuration-errors');

class ListSnapshots extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.programsCached = [];
    this.environmentsCached = [];
  }

  async runCommand(args, flags) {
    let response;
    const result = this.jsonResult();
    try {
      this.spinnerStart('fetching snapshots');
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.getSnapshots()
      );
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
      );
    } finally {
      this.spinnerStop();
    }

    if (response.status === 200) {
      const json = await response.json();
      result.status = json?.status;
      this.spinnerStop();
      if (json?.items?.length === 0) {
        this.doLog('There are no snapshots yet.');
      } else {
        result.snapshots = json;
        this.logInTableFormat(json);
      }
    } else if (response?.status === 400) {
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
    } else {
      throw new internalCodes.UNKNOWN();
    }
    return result;
  }

  logInTableFormat(items) {
    // Helper to format bytes to MB or GB
    function formatSize(bytes) {
      if (typeof bytes !== 'number' || isNaN(bytes)) return '';
      const gb = 1024 * 1024 * 1024;
      const mb = 1024 * 1024;
      if (bytes >= gb) {
        return (bytes / gb).toFixed(2) + ' GB';
      } else if (bytes >= mb) {
        return (bytes / mb).toFixed(2) + ' MB';
      }
      return bytes + ' B';
    }

    const mappedItems = items.map((item) => {
      const sizeBytes = item.size?.total_size ?? item.size;
      return {
        ...item,
        size: formatSize(sizeBytes),
      };
    });

    cli.table(
      mappedItems,
      {
        name: {
          minWidth: 20,
        },
        description: {
          minWidth: 20,
        },
        usage: {},
        size: {},
        state: {},
        created: {},
        lastUsed: { header: 'Last Used' },
      },
      { printLine: (s) => this.doLog(s, true) }
    );
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

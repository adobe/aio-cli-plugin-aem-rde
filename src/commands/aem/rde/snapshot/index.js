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

const DATE_FORMATTER = (val) =>
  new Date(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

// Helper to format bytes to MB or GB
const BYTE_FORMATTER = (bytes) => {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '';
  const kb = 1024;
  const mb = 1024 * kb;
  const gb = 1024 * mb;
  if (bytes >= gb) {
    return (bytes / gb).toFixed(2) + ' GB';
  } else if (bytes >= mb) {
    return (bytes / mb).toFixed(2) + ' MB';
  } else if (bytes >= kb) {
    return (bytes / kb).toFixed(2) + ' KB';
  }
  return bytes + ' B';
};

const SIZE_FORMATTER = (size) => {
  const bytes = size.total_size ?? size;
  return BYTE_FORMATTER(bytes);
};

const FORMATTERS = {
  created: DATE_FORMATTER,
  lastUsed: DATE_FORMATTER,
  size: SIZE_FORMATTER,
};

const formatItem = (row) => {
  const copy = Object.assign({}, row);
  const keys = Object.keys(copy);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (Object.hasOwn(FORMATTERS, key)) {
      copy[key] = FORMATTERS[key].call(null, copy[key]);
    }
  }
  return copy;
};

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

    if (response?.status === 451) {
      throw new configurationCodes.NON_EAP();
    } else if (response.status === 200) {
      const json = await response.json();
      result.status = response.status;
      this.spinnerStop();
      if (json?.length === 0) {
        this.doLog('There are no snapshots yet.');
      } else {
        result.snapshots = json;
        this.logInTableFormat(json, flags);
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

  logInTableFormat(items, flags) {
    cli.table(
      items.map(formatItem),
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
      {
        sort: flags.sort,
        printLine: (s) => this.doLog(s, true),
      }
    );
  }
}

Object.assign(ListSnapshots, {
  description:
    'Lists all content and deployment snapshots in your organization. Use --help for a list of subcommands.',
  args: [],
  aliases: [],
  flags: {
    sort: Flags.string({
      description:
        'Sort the table by a table header, prefixed by a minus symbol for reverse sorting',
      char: 's',
      multiple: false,
      required: false,
      default: '-Last Used',
    }),
  },
});

module.exports = ListSnapshots;

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
const { codes: snapshotCodes } = require('../../../../lib/snapshot-errors');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const chalk = require('chalk');

class DeleteSnapshots extends BaseCommand {
  async runCommand(args, flags) {
    if (flags.all) {
      this.deleteAllSnapshots();
    } else {
      this.deleteSnapshot(args.name);
    }
  }

  async deleteAllSnapshots() {
    let response;
    try {
      this.spinnerStart('fetching all snapshots');
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
      this.spinnerStop();
      if (json?.items?.length === 0) {
        this.doLog('There are no snapshots yet.');
      } else {
        json?.items.forEach((e) => this.deleteSnapshot(e.name));
      }
    } else {
      throw new internalCodes.UNKNOWN();
    }
  }

  async deleteSnapshot(name) {
    let response;
    try {
      this.spinnerStart(`Deleting snapshot ${name}...`);
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.deleteSnapshot(name)
      );
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
      );
    }
    this.spinnerStop();
    if (response?.status === 200) {
      this.doLog(
        chalk.green(
          `Snapshot ${name} deleted successfully. Use 'aio rde snapshot' to view its updated state, it will be removed once the retention time has passed. Use 'aio rde snapshot restore' to restore it.`
        )
      );
    } else if (response?.status === 404) {
      throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
    } else {
      throw new internalCodes.UNKNOWN();
    }
  }
}

Object.assign(DeleteSnapshots, {
  description:
    'Marks a snapshot for deletion. The snapshot will be deleted after 7 days. A previously deleted snapshot can be restored.',
  args: [
    {
      name: 'name',
      description: 'The name of the snapshot to apply to the current RDE.',
      required: true,
    },
  ],
  aliases: [],
  flags: {
    all: Flags.boolean({
      description: 'Wipe all snapshots from the organization.',
      char: 'a',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = DeleteSnapshots;

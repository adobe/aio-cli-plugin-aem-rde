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
const {
  codes: configurationCodes,
} = require('../../../../lib/configuration-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const chalk = require('chalk');

class ApplySnapshots extends BaseCommand {
  async runCommand(args, flags) {
    let response;
    try {
      this.spinnerStart(`Applying snapshot ${args.name}...`);
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.applySnapshot(args.name, {
          'only-mutable-content': flags['only-mutable-content'],
        })
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
          `Snapshot ${args.name} applied successfully. Use 'aio aem rde status' to view installed artifacts.`
        )
      );
    } else if (response?.status === 400) {
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      const json = await response.json();
      if (
        json.details === 'The requested environment or program does not exist.'
      ) {
        throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
      } else if (json.details === 'The requested snapshot does not exist.') {
        throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
      } else if (json.details === 'The snapshot is in deleted state.') {
        throw new snapshotCodes.SNAPSHOT_DELETED();
      }
    } else if (response?.status === 406) {
      throw new snapshotCodes.INVALID_STATE();
    } else {
      throw new internalCodes.UNKNOWN();
    }
  }
}

Object.assign(ApplySnapshots, {
  description: 'Applies a snapshot to the environment.',
  args: [
    {
      name: 'name',
      description: 'The name of the snapshot to apply to the current RDE.',
      required: true,
    },
  ],
  aliases: [],
  flags: {
    'only-mutable-content': Flags.boolean({
      description: 'Applies the mutable content only.',
      multiple: false,
      required: false,
      default: false,
    }),
    quiet: Flags.boolean({
      description:
        'Does not ask for user confirmation before applying the snapshot.',
      char: 'q',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = ApplySnapshots;

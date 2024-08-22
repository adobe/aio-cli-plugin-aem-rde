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

class CreateSnapshots extends BaseCommand {
  async runCommand(args, flags) {
    let response;
    try {
      this.spinnerStart(`Creating snapshot ${args.name}...`);
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.createSnapshot(args.name, {
          description: flags.description,
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
          `Snapshot ${args.name} created successfully. Use 'aio aem rde snapshot' to view or 'aio aem rde snapshot apply ${args.name}' to apply it on the RDE.`
        )
      );
    } else if (response?.status === 400) {
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
    } else if (response?.status === 406) {
      throw new snapshotCodes.INVALID_STATE();
    } else if (response?.status === 409) {
      throw new snapshotCodes.ALREADY_EXISTS();
    } else {
      throw new internalCodes.UNKNOWN();
    }
  }
}

Object.assign(CreateSnapshots, {
  description:
    'Creates a snapshot of the current state of the environment, includes content and deployment.',
  args: [
    {
      name: 'name',
      description:
        'The name of the new snapshot. The name must be unique within the environment.',
      required: true,
    },
  ],
  aliases: [],
  flags: {
    description: Flags.string({
      description: 'A brief description of the snapshot.',
      char: 'd',
      multiple: false,
      required: false,
    }),
  },
});

module.exports = CreateSnapshots;

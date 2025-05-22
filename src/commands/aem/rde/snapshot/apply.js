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
const { codes: validationCodes } = require('../../../../lib/validation-errors');
const {
  codes: configurationCodes,
} = require('../../../../lib/configuration-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const chalk = require('chalk');

const { sleepMillis } = require('../../../../lib/utils');
const { loadAllArtifacts } = require('../../../../lib/rde-utils');

const Spinnies = require('spinnies');

class ApplySnapshots extends BaseCommand {
  async runCommand(args, flags) {
    const spinnies = new Spinnies();

    if (!flags.status) {
      spinnies.add('spinner-requesting', {
        text: `Requesting to apply snapshot ${args.name} (<1m) ...`,
      });
    }
    spinnies.add('spinner-backend', {
      text: 'Waiting for backend to pick up the job to apply the snapshot (<1min) ...',
    });
    spinnies.add('spinner-apply', {
      text: 'Applying snapshot to RDE (2-5m) ...',
    });
    spinnies.add('spinner-restart', {
      text: 'Wait for the RDE to restart (5-10m)...',
    });

    const result = this.jsonResult();
    const startTime = Date.now();
    result.startTime = startTime;
    if (!flags.status) {
      let response;
      try {
        response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.applySnapshot(args.name, {
            'only-mutable-content': flags['only-mutable-content'],
          })
        );
      } catch (err) {
        result.error = err;
        spinnies.stopAll('fail');
        throwAioError(
          err,
          new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
        );
      }

      if (response?.status === 200) {
        const took = this.formatElapsedTime(startTime, Date.now());
        spinnies.succeed('spinner-requesting', {
          text: `Requested to apply snapshot successfully. (${took})`,
          successColor: 'greenBright',
        });
      } else if (response?.status === 400) {
        throw new configurationCodes.DIFFERENT_ENV_TYPE();
      } else if (response?.status === 404) {
        const json = await response.json();
        if (
          json.details ===
          'The requested environment or program does not exist.'
        ) {
          throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
        } else if (json.details === 'The requested snapshot does not exist.') {
          throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
        } else if (json.details === 'The snapshot is in deleted state.') {
          throw new snapshotCodes.SNAPSHOT_DELETED();
        }
      } else if (response?.status === 406) {
        throw new snapshotCodes.INVALID_STATE();
      } else if (response?.status === 503) {
        throw new validationCodes.DEPLOYMENT_IN_PROGRESS();
      } else {
        spinnies.stopAll('fail');
        throw new internalCodes.UNKNOWN();
      }
    }

    let lastProgress = -1;
    result.waitingforbackend = new Date();

    while (lastProgress < 100) {
      let progressResponse;
      try {
        progressResponse = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSnapshotProgress('apply', args.name)
        );
      } catch (err) {
        result.error = err;
        spinnies.stopAll('fail');
        throwAioError(
          err,
          new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
        );
      }

      if (progressResponse.status === 200) {
        const json = await progressResponse.json();
        lastProgress = json?.progressPercentage;
      } else if (progressResponse.status === 404) {
        throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
      } else {
        spinnies.stopAll('fail');
        this.doLog('Could not get the progress of the snapshot application.');
        throw new internalCodes.UNKNOWN();
      }

      if (lastProgress > 0) {
        const took = this.formatElapsedTime(
          result.waitingforbackend,
          Date.now()
        );
        spinnies.succeed('spinner-backend', {
          text: `Backend picked up the job to apply the snapshot. (${took})`,
          successColor: 'greenBright',
        });
        result.processnigsnapshotstarted = new Date();
      }
      await sleepMillis(5000);
    }

    if (lastProgress === 100) {
      const took = this.formatElapsedTime(
        result.processnigsnapshotstarted,
        Date.now()
      );
      spinnies.succeed('spinner-apply', {
        text: `Applied snapshot to RDE successfully. (${took})`,
        successColor: 'greenBright',
      });
    }
    result.processnigsnapshotended = new Date();

    while (true) {
      const status = await this.withCloudSdk((cloudSdkAPI) =>
        loadAllArtifacts(cloudSdkAPI)
      );
      if (status.status === 'Ready') {
        break;
      }
      await sleepMillis(10000);
    }

    const took = this.formatElapsedTime(
      result.processnigsnapshotended,
      Date.now()
    );
    spinnies.succeed('spinner-restart', {
      text: `RDE restarted successfully. (${took})`,
      successColor: 'greenBright',
    });

    this.doLog(
      chalk.green(
        `Snapshot ${args.name} applied successfully. Check the deployment using the command: 'aio aem rde status'`
      )
    );

    result.endTime = Date.now();
    this.doLog(
      chalk.yellow(
        `Total time to rebase on snapshot: ${this.formatElapsedTime(startTime, result.endTime)}`
      )
    );
    result.totalseconds = (result.endTime - startTime) / 1000;
    return result;
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
    status: Flags.boolean({
      description:
        'Checks the progress of the snapshot application. If the snapshot is already applied, it will return the progress.',
      char: 's',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = ApplySnapshots;

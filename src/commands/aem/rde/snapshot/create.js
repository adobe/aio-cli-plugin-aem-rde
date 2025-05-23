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

const { sleepMillis } = require('../../../../lib/utils');
const { loadAllArtifacts } = require('../../../../lib/rde-utils');

const Spinnies = require('spinnies');

class CreateSnapshots extends BaseCommand {
  async runCommand(args, flags) {
    const spinnies = flags.quiet || flags.json ? undefined : new Spinnies();
    spinnies?.add('spinner-requesting', {
      text: `Requesting to create snapshot ${args.name} (<1m) ...`,
    });
    spinnies?.add('spinner-backend', {
      text: 'Waiting for backend to pick up the job to create the snapshot (<1min) ...',
    });
    spinnies?.add('spinner-create', {
      text: 'Locking RDE and create the snapshot (2-5m) ...',
    });
    spinnies?.add('spinner-restart', {
      text: 'Unlocking the RDE (1-2m)...',
    });

    const result = this.jsonResult();
    const startTime = Date.now();
    result.startTime = startTime;

    let response;
    try {
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.createSnapshot(args.name, {
          description: flags.description,
        })
      );
    } catch (err) {
      spinnies?.stopAll('fail');
      throwAioError(
        err,
        new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
      );
    }
    if (response?.status === 200 || response?.status === 201) {
      const took = this.formatElapsedTime(startTime, Date.now());
      spinnies?.succeed('spinner-requesting', {
        text: `Requested to create the snapshot successfully. (${took})`,
        successColor: 'greenBright',
      });
    } else if (response?.status === 400) {
      spinnies?.stopAll('fail');
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      spinnies?.stopAll('fail');
      throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
    } else if (response?.status === 409) {
      spinnies?.stopAll('fail');
      throw new snapshotCodes.ALREADY_EXISTS();
    } else if (response?.status === 503) {
      spinnies?.stopAll('fail');
      throw new snapshotCodes.INVALID_STATE();
    } else if (response?.status === 507) {
      spinnies?.stopAll('fail');
      throw new snapshotCodes.SNAPSHOT_LIMIT();
    } else {
      spinnies?.stopAll('fail');
      throw new internalCodes.UNKNOWN();
    }

    let lastProgress = -1;
    result.waitingforbackend = new Date();

    while (lastProgress < 100) {
      let progressResponse;
      try {
        progressResponse = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSnapshotProgress('snapshot_create', args.name)
        );
      } catch (err) {
        result.error = err;
        spinnies?.stopAll('fail');
        throwAioError(
          err,
          new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
        );
      }

      if (progressResponse.status === 200) {
        const json = await progressResponse.json();
        lastProgress = json?.progressPercentage;
      } else if (progressResponse.status === 404) {
        spinnies?.stopAll('fail');
        throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
      } else {
        spinnies?.stopAll('fail');
        this.doLog('Could not get the progress of the snapshot creation.');
        spinnies?.stopAll('fail');
        throw new internalCodes.UNKNOWN();
      }

      if (lastProgress > 0 && !result.processnigsnapshotstarted) {
        const took = this.formatElapsedTime(
          result.waitingforbackend,
          Date.now()
        );
        spinnies?.succeed('spinner-backend', {
          text: `Backend picked up the job to create the snapshot. (${took})`,
          successColor: 'greenBright',
        });
        result.processnigsnapshotstarted = new Date();
      }
      if (lastProgress === -2) {
        spinnies?.stopAll('fail');
        this.doLog(chalk.red('Snapshot creation failed.'));
        this.notify('failed', 'Snapshot creation failed.');
        throw new snapshotCodes.SNAPSHOT_CREATION_FAILED();
      }

      await sleepMillis(5000);
    }

    if (lastProgress === 100) {
      const took = this.formatElapsedTime(
        result.processnigsnapshotstarted,
        Date.now()
      );
      spinnies?.succeed('spinner-create', {
        text: `Created snapshot successfully. (${took})`,
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
    spinnies?.succeed('spinner-restart', {
      text: `RDE unlocked successfully. (${took})`,
      successColor: 'greenBright',
    });

    this.doLog(
      chalk.green(
        `Snapshot ${args.name} created successfully. Check the list of snapshots using the command: 'aio aem rde snapshot'`
      )
    );

    result.endTime = new Date();
    this.doLog(
      chalk.yellow(
        `Total time to create the snapshot: ${this.formatElapsedTime(startTime, Date.now())}`
      )
    );
    result.totalseconds = (result.endTime - startTime) / 1000;
    result.startTime = new Date(startTime);
    this.notify('restored', 'Snapshot created.');
    return result;
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

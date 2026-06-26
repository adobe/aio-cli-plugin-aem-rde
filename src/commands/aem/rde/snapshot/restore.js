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

const { BaseCommand, Flags, commonFlags } = require('../../../../lib/base-command');
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
const Spinnies = require('../../../../lib/spinnies-wrapper');

class RestoreSnapshot extends BaseCommand {
  constructor(argv, config, sleepTime = 5000) {
    super(argv, config, null, ['snapshots']);
    this.sleepTime = sleepTime;
  }

  async runCommand(args, flags) {
    this._spinnies = this.getSpinnies(flags);
    const initSpinnies = (sp) => {
      if (!flags.status) {
        sp?.add('spinner-requesting', {
          text: `Requesting to restore snapshot ${args.name} (<1m) ...`,
        });
      }
      sp?.add('spinner-backend', {
        text: 'Waiting for backend to pick up the job to restore the snapshot (<1min) ...',
      });
      sp?.add('spinner-restore', {
        text: 'Restoring snapshot to RDE (2-5m) ...',
      });
      sp?.add('spinner-restart', {
        text: 'Wait for the RDE to restart (5-10m)...',
      });
    };
    initSpinnies(this._spinnies);

    const result = this.jsonResult();
    const startTime = Date.now();
    result.startTime = startTime;
    let response;
    try {
      response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.restoreSnapshot(args.name, {
          'only-mutable-content': flags['only-mutable-content'],
        })
      );
    } catch (err) {
      result.error = err;
      this._spinnies?.stopAll('fail');
      throwAioError(
        err,
        new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
      );
    }
    let actionid;
    if (response?.status === 200) {
      const json = await response.json();
      actionid = json?.actionid;
      const took = this.formatElapsedTime(startTime, Date.now());
      this._spinnies?.succeed('spinner-requesting', {
        text: `Requested to restore the snapshot successfully. (${took})`,
        successColor: 'greenBright',
      });
    } else if (response?.status === 400) {
      this._spinnies?.stopAll('fail');
      throw new configurationCodes.DIFFERENT_ENV_TYPE();
    } else if (response?.status === 404) {
      const json = await response.json();
      if (
        json.details === 'The requested environment or program does not exist.'
      ) {
        this._spinnies?.stopAll('fail');
        throw new configurationCodes.PROGRAM_OR_ENVIRONMENT_NOT_FOUND();
      } else if (json.details === 'The requested snapshot does not exist.') {
        this._spinnies?.stopAll('fail');
        throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
      } else if (json.details === 'The snapshot is in deleted state.') {
        this._spinnies?.stopAll('fail');
        throw new snapshotCodes.SNAPSHOT_DELETED();
      }
    } else if (response?.status === 406) {
      this._spinnies?.stopAll('fail');
      throw new snapshotCodes.INVALID_STATE();
    } else if (response?.status === 503) {
      this._spinnies?.stopAll('fail');
      throw new validationCodes.DEPLOYMENT_IN_PROGRESS();
    } else {
      this._spinnies?.stopAll('fail');
      throw new internalCodes.UNKNOWN();
    }

    let lastProgress = -1;
    result.waitingforbackend = new Date();

    while (lastProgress < 100) {
      let progressResponse;
      try {
        progressResponse = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getSnapshotProgress(
            'snapshot_restore',
            args.name,
            actionid
          )
        );
      } catch (err) {
        result.error = err;
        this._spinnies?.stopAll('fail');
        throwAioError(
          err,
          new internalCodes.INTERNAL_SNAPSHOT_ERROR({ messageValues: err })
        );
      }

      if (progressResponse.status === 200) {
        const json = await progressResponse.json();
        lastProgress = json?.progressPercentage;
      } else if (progressResponse.status === 404) {
        this._spinnies?.stopAll('fail');
        throw new snapshotCodes.SNAPSHOT_NOT_FOUND();
      } else {
        this._spinnies?.stopAll('fail');
        this.doLog(
          `Could not get the progress of the snapshot application. Status code: ${progressResponse.status}`
        );
        throw new internalCodes.UNKNOWN();
      }

      if (lastProgress > 0 && !result.processnigsnapshotstarted) {
        const took = this.formatElapsedTime(
          result.waitingforbackend,
          Date.now()
        );
        this._spinnies?.succeed('spinner-backend', {
          text: `Backend picked up the job to restore the snapshot. (${took})`,
          successColor: 'greenBright',
        });
        result.processnigsnapshotstarted = new Date();
      }
      if (lastProgress === -2) {
        this._spinnies?.stopAll('fail');
        this.doLog(chalk.red('Snapshot creation failed.'));
        this.notify('failed', 'Snapshot creation failed.');
        throw new snapshotCodes.SNAPSHOT_RESTORE_FAILED();
      }
      await sleepMillis(this.sleepTime);
    }

    if (lastProgress === 100) {
      const took = this.formatElapsedTime(
        result.processnigsnapshotstarted,
        Date.now()
      );
      this._spinnies?.succeed('spinner-restore', {
        text: `Restored snapshot to RDE successfully. (${took})`,
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
      await sleepMillis(this.sleepTime * 2);
    }

    const took = this.formatElapsedTime(
      result.processnigsnapshotended,
      Date.now()
    );
    this._spinnies?.succeed('spinner-restart', {
      text: `RDE restarted successfully. (${took})`,
      successColor: 'greenBright',
    });

    this.doLog(
      chalk.green(
        `Snapshot ${args.name} restored successfully. Check the deployment using the command: 'aio aem rde status'`
      )
    );

    result.endTime = new Date();
    this.doLog(
      chalk.yellow(
        `Total time to rebase on snapshot: ${this.formatElapsedTime(startTime, Date.now())}`
      )
    );
    result.startTime = new Date(startTime);
    result.totalseconds = (result.endTime - startTime) / 1000;
    this.notify('restored', 'Snapshot restored.');
    return result;
  }

  onBeforePrompt() {
    this._spinnies?.suspendAll();
  }

  onAfterPrompt(accepted) {
    if (accepted && this._spinnies) {
      this._spinnies.resumeAll();
    }
  }

  getSpinnies(flags) {
    return flags.quiet || flags.json ? undefined : new Spinnies();
  }
}

Object.assign(RestoreSnapshot, {
  description: 'Restores a snapshot to the environment.',
  args: [
    {
      name: 'name',
      description: 'The name of the snapshot to restore to the current RDE.',
      required: true,
    },
  ],
  aliases: [],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    'only-mutable-content': Flags.boolean({
      description: 'Restores the mutable content only.',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = RestoreSnapshot;

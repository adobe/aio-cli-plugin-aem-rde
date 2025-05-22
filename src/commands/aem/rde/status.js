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

const {
  BaseCommand,
  commonFlags,
  Flags,
} = require('../../../lib/base-command');
const { loadAllArtifacts, groupArtifacts } = require('../../../lib/rde-utils');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const { sleepMillis } = require('../../../lib/utils');

class StatusCommand extends BaseCommand {
  async runCommand(args, flags) {
    try {
      this.doLog(`Info for cm-p${this._programId}-e${this._environmentId}`);

      let status;
      if (flags?.wait) {
        this.spinnerStart(
          'retrieving environment status information - waiting for ready state'
        );
        while (true) {
          status = await this.withCloudSdk((cloudSdkAPI) =>
            loadAllArtifacts(cloudSdkAPI)
          );
          if (status.status === 'Ready') {
            break;
          }
          await sleepMillis(10000);
        }
        this.notify('ready', 'RDE environment is ready');
      } else {
        this.spinnerStart('retrieving environment status information');
        status = await this.withCloudSdk((cloudSdkAPI) =>
          loadAllArtifacts(cloudSdkAPI)
        );
      }

      this.spinnerStop();
      this.doLog(`Environment: ${status.status}`, true);
      const result = this.jsonResult(status.status);
      if (status.error) {
        result.statusText = status.BaseCommand;
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [status.status, status.error],
        });
      }

      const grouped = groupArtifacts(status.items);

      this.doLog('- Bundles Author:', true);
      grouped.author['osgi-bundle'].forEach((bundle) =>
        this.doLog(
          ` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`,
          true
        )
      );
      this.doLog('- Bundles Publish:', true);
      grouped.publish['osgi-bundle'].forEach((bundle) =>
        this.doLog(
          ` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`,
          true
        )
      );
      this.doLog('- Configurations Author:', true);
      grouped.author['osgi-config'].forEach((config) =>
        this.doLog(` ${config.metadata.configPid} `, true)
      );
      this.doLog('- Configurations Publish:', true);
      grouped.publish['osgi-config'].forEach((config) =>
        this.doLog(` ${config.metadata.configPid} `, true)
      );

      result.author = {
        osgiBundles: grouped.author['osgi-bundle'],
        osgiConfigs: grouped.publish['osgi-config'],
      };
      result.publish = {
        osgiBundles: grouped.author['osgi-bundle'],
        osgiConfigs: grouped.publish['osgi-config'],
      };

      return result;
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_STATUS_ERROR({ messageValues: err })
      );
    }
  }
}

Object.assign(StatusCommand, {
  description:
    'Get a list of the bundles and configs deployed to the current rde.',
  args: [],
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    quiet: commonFlags.quiet,
    wait: Flags.boolean({
      description: 'Wait for the environment to be ready',
      char: 'w',
      multiple: false,
      required: false,
      default: false,
    }),
  },
  usage: [
    'status              # output as textual content',
    'status --json       # output as json object',
    'status --wait       # wait for the environment to be ready',
  ],
  aliases: [],
});

module.exports = StatusCommand;

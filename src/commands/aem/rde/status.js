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

const { BaseCommand, commonFlags } = require('../../../lib/base-command');
const { loadAllArtifacts, groupArtifacts } = require('../../../lib/rde-utils');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
class StatusCommand extends BaseCommand {
  async runCommand(args, flags) {
    if (flags.json) {
      await this.printAsJson();
    } else {
      await this.printAsText();
    }
  }

  async printAsText() {
    try {
      this.doLog(`Info for cm-p${this._programId}-e${this._environmentId}`);
      this.spinnerStart('retrieving environment status information');
      const status = await this.withCloudSdk((cloudSdkAPI) =>
        loadAllArtifacts(cloudSdkAPI)
      );
      this.spinnerStop();
      this.doLog(`Environment: ${status.status}`, true);
      if (status.error) {
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
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_STATUS_ERROR({ messageValues: err })
      );
    }
  }

  async printAsJson() {
    try {
      const status = await this.withCloudSdk((cloudSdkAPI) =>
        loadAllArtifacts(cloudSdkAPI)
      );

      const grouped = groupArtifacts(status.items);

      const result = {
        programId: this._programId,
        environmentId: this._environmentId,
        status: status.status,
      };

      if (status.error) {
        result.statusText = status.BaseCommand;
      } else {
        result.author = {
          osgiBundles: grouped.author['osgi-bundle'],
          osgiConfigs: grouped.publish['osgi-config'],
        };
        result.publish = {
          osgiBundles: grouped.author['osgi-bundle'],
          osgiConfigs: grouped.publish['osgi-config'],
        };
      }

      this.doLog(JSON.stringify(result), true);
    } catch (err) {
      this.spinnerStop();
      this.doLog(err);
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
    json: commonFlags.json,
    quiet: commonFlags.quiet,
  },
  usage: [
    'status              # output as textual content',
    'status --json       # output as json object',
  ],
  aliases: [],
});

module.exports = StatusCommand;

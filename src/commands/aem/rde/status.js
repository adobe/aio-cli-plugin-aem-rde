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

const { BaseCommand, cli, Flags, commonFlags } = require('../../../lib/base-command');
const { loadAllArtifacts, groupArtifacts } = require('../../../lib/rde-utils');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const spinner = require('ora')();

class StatusCommand extends BaseCommand {
  async run() {
    const { flags } = await this.parse(StatusCommand);
    if (flags.json) {
      await this.printAsJson(flags);
    } else {
      await this.printAsText(flags);
    }
  }

  async printAsText(flags) {
    try {
      cli.log(`Info for cm-p${this.getProgramId(flags)}-e${this.getEnvironmentId(flags)}`);
      spinner.start('retrieving environment status information');
      const status = await this.withCloudSdk(flags,(cloudSdkAPI) =>
        loadAllArtifacts(cloudSdkAPI)
      );
      spinner.stop();
      cli.log(`Environment: ${status.status}`);
      if (status.error) {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [status.status, status.error],
        });
      }

      const grouped = groupArtifacts(status.items);

      cli.log('- Bundles Author:');
      grouped.author['osgi-bundle'].forEach((bundle) =>
        cli.log(
          ` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`
        )
      );
      cli.log('- Bundles Publish:');
      grouped.publish['osgi-bundle'].forEach((bundle) =>
        cli.log(
          ` ${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}`
        )
      );
      cli.log('- Configurations Author:');
      grouped.author['osgi-config'].forEach((config) =>
        cli.log(` ${config.metadata.configPid} `)
      );
      cli.log('- Configurations Publish:');
      grouped.publish['osgi-config'].forEach((config) =>
        cli.log(` ${config.metadata.configPid} `)
      );
    } catch (err) {
      spinner.stop();
      throwAioError(
        err,
        new internalCodes.INTERNAL_STATUS_ERROR({ messageValues: err })
      );
    }
  }

  async printAsJson(flags) {
    try {
      const status = await this.withCloudSdk(flags,(cloudSdkAPI) =>
        loadAllArtifacts(cloudSdkAPI)
      );

      const grouped = groupArtifacts(status.items);

      const result = {
        programId: this.getProgramId(flags),
        environmentId: this.getEnvironmentId(flags),
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

      cli.log(JSON.stringify(result));
    } catch (err) {
      spinner.stop();
      cli.log(err);
    }
  }
}

Object.assign(StatusCommand, {
  description:
    'Get a list of the bundles and configs deployed to the current rde.',
  args: [],
  flags: {
    ...commonFlags.global,
    json: Flags.boolean({
      char: 'j',
      hidden: false,
      description: 'output as json',
    }),
  },
  usage: [
    'status              # output as textual content',
    'status --json       # output as json object',
  ],
  aliases: [],
});

module.exports = StatusCommand;

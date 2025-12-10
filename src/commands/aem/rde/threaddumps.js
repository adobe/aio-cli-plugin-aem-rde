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

const fs = require('fs');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const { BaseCommand, commonFlags } = require('../../../lib/base-command');

class TheaddumpCommand extends BaseCommand {
  async runCommand(args, flags) {
    this.flags = flags || {};
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.getAemThreaddumps(flags.target)
      );

      if (response.status === 200) {
        const text = await response.text();
        const now = new Date();
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
        const filename = `jstack.threaddump_${date}_${time}.dump`;
        fs.writeFileSync(filename, text);
      } else {
        throw new internalCodes.UNEXPECTED_API_ERROR({
          messageValues: [response.status, response.statusText],
        });
      }
    } catch (err) {
      throwAioError(
        err,
        new internalCodes.INTERNAL_GET_LOG_ERROR({ messageValues: err })
      );
    }
  }
}

Object.assign(TheaddumpCommand, {
  description: 'Do not support json putput for thread dump command.',
  enableJsonFlag: false,
});

Object.assign(TheaddumpCommand, {
  description:
    'Download the thread dumps for the target of a rapid development environment.',
  flags: {
    organizationId: commonFlags.organizationId,
    programId: commonFlags.programId,
    environmentId: commonFlags.environmentId,
    target: commonFlags.targetInspect,
    quiet: commonFlags.quiet,
  },
});

module.exports = TheaddumpCommand;

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
const {
  BaseCommand,
  commonFlags,
  Flags,
} = require('../../../lib/base-command');
const { createFetch } = require('@adobe/aio-lib-core-networking');
const fetch = createFetch();

class TheaddumpCommand extends BaseCommand {
  async runCommand(args, flags) {
    this.flags = flags || {};
    try {
      const response = await this.withCloudSdk((cloudSdkAPI) =>
        cloudSdkAPI.getAemThreaddumps(flags.target)
      );

      if (response.status === 200) {
        const threadDumpContent = await response.text();
        const timestamp = new Date().toISOString();
        
        
        if(!flags.skipAnalysis) {
          // Get MARKETPLACE_TOKEN from environment
          const marketplaceToken = process.env.MARKETPLACE_TOKEN;
          if (!marketplaceToken) {
            throw new Error('MARKETPLACE_TOKEN environment variable is not set');
          }

          // Prepare the request payload
          const payload = {
            thread_dump_content: threadDumpContent,
            dump_label: `${flags.target}_dump`,
            timestamp: timestamp,
            mode: flags.verbose ? 'verbose' : 'compact'
          };

          // Call the thread dump analysis API
          const apiResponse = await fetch(
            'https://aem-agent-marketplace-apim-stage-ddse.azure-api.net/api/agents?operation=thread_dump_analysis',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-GATEWAY-SESSION': 'accept',
                'Authorization': `Bearer ${marketplaceToken}`
              },
              body: JSON.stringify(payload)
            }
          );

          if (!apiResponse.ok) {
            throw new Error(
              `API request failed with status ${apiResponse.status}: ${apiResponse.statusText}`
            );
          }

          const apiResult = await apiResponse.json();
          this.doLog('Thread dump analysis completed successfully');
          const jsonResult = JSON.stringify(apiResult, null, 2);
          fs.writeFileSync(`threaddump_${timestamp}_analyzed.json`, jsonResult);

          if(apiResult?.analysis) {
            this.doLog(apiResult.analysis);
            const formattedAnalysis = apiResult.analysis.replace(/\\n/g, '\n');
            fs.writeFileSync(`threaddump_${timestamp}_analysis.md`, formattedAnalysis);
          }
        }
        
        if(flags.saveRaw) {
          this.doLog('Thread dump raw saved to file');
          fs.writeFileSync(`jstack.threaddump_${timestamp}.dump`, threadDumpContent);
        }
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
    saveRaw: Flags.boolean({
      description: 'Save the raw thread dump to a file.',
      char: 'r',
      multiple: false,
      required: false,
      default: false,
    }),
    skipAnalysis: Flags.boolean({
      description: 'Skip the analysis of the thread dump.',
      char: 'n',
      multiple: false,
      required: false,
      default: false,
    }),
    verbose: Flags.boolean({
      description: 'Create a verbose analysis report.',
      char: 'v',
      multiple: false,
      required: false,
      default: false,
    }),
  },
  usage: [
    'threadump                # create a thread dump and analyze it',
    'threadump --saveRaw      # save the raw thread dump to a file',
    'threadump --skipAnalysis # skip the analysis of the thread dump',
    'threadump --verbose      # create a verbose analysis report',
  ],
  aliases: [],
});

module.exports = TheaddumpCommand;
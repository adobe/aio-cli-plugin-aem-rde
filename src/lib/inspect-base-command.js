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
const { CloudSdkAPI } = require('./cloud-sdk-api');
const Config = require('@adobe/aio-lib-core-config');
const jwt = require('jsonwebtoken');
const { codes: configurationCodes } = require('./configuration-errors');
const { codes: validationCodes } = require('./validation-errors');
const {
  BaseCommand,
  getCliOrgId,
  getBaseUrl,
  Flags,
  cli,
} = require('./base-command');

/**
 * @param {object} items - The items displayed in the table.
 */
function logInJsonArrayFormat(items) {
  let jsonArray = '[\n';
  items.forEach((item) => {
    jsonArray += '  ' + JSON.stringify(item) + ',\n';
  });
  jsonArray = jsonArray.slice(0, -2);
  jsonArray += '\n]';
  cli.log(jsonArray);
}

/**
 *
 */
async function getTokenAndKey() {
  const accessToken = Config.get('aem-rde.inspect.ims_access_token.token');
  if (!accessToken) {
    throw new configurationCodes.MISSING_INSPECT_ACCESS_TOKEN().message;
  }
  const decodedToken = jwt.decode(accessToken);
  if (!decodedToken) {
    throw new configurationCodes.CLI_AUTH_CONTEXT_CANNOT_DECODE().message;
  }
  const apiKey = decodedToken.client_id;
  if (!apiKey) {
    throw new configurationCodes.CLI_AUTH_CONTEXT_NO_CLIENT_ID().message;
  }
  return { accessToken, apiKey };
}

class InspectBaseCommand extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
  }

  async withCloudSdk(flags, fn) {
    if (!this._cloudSdkAPI) {
      const programId = this.getProgramId(flags);
      const environmentId = this.getEnvironmentId(flags);

      const { accessToken, apiKey } = await getTokenAndKey();
      const cacheKey = `aem-rde.dev-console-url-cache.cm-p${programId}-e${environmentId}`;
      let cacheEntry = Config.get(cacheKey);
      // TODO: prune expired cache entries
      if (
        !cacheEntry ||
        new Date(cacheEntry.expiry).valueOf() < Date.now() ||
        !cacheEntry.devConsoleUrl
      ) {
        const cloudManagerUrl = getBaseUrl();
        const orgId = getCliOrgId();
        const developerConsoleUrl = await this.getDeveloperConsoleUrl(
          cloudManagerUrl,
          orgId,
          programId,
          environmentId
        );
        const url = new URL(developerConsoleUrl);
        url.hash = '';
        const devConsoleUrl = url.toString();
        url.pathname = '/api/rde';
        const rdeApiUrl = url.toString();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // cache for at most one day
        cacheEntry = {
          expiry: expiry.toISOString(),
          rdeApiUrl,
          devConsoleUrl,
        };
        Config.set(cacheKey, cacheEntry);
      }
      this._cloudSdkAPI = new CloudSdkAPI(
        getBaseUrl(),
        cacheEntry.devConsoleUrl,
        cacheEntry.rdeApiUrl,
        apiKey,
        getCliOrgId(),
        programId,
        environmentId,
        accessToken
      );
    }
    return fn(this._cloudSdkAPI);
  }

  getProgramId(flags) {
    const programId = flags.programId || Config.get('cloudmanager_programid');
    if (!programId) {
      throw new Error('No programId');
    }
    return programId;
  }

  getEnvironmentId(flags) {
    const environmentId =
      flags.environmentId || Config.get('cloudmanager_environmentid');
    if (!environmentId) {
      throw new Error('No environmentId');
    }
    return environmentId;
  }
}

module.exports = {
  InspectBaseCommand,
  inspectCommonFlags: {
    global: {
      programId: Flags.string({
        description:
          "The programId. If not specified, defaults to 'cloudmanager_programId' config value",
        common: true,
        multiple: false,
        required: false,
      }),
      environmentId: Flags.string({
        description:
          "the environmentId. If not specified, defaults to 'cloudmanager_environmentid' config value",
        common: true,
        multiple: false,
        required: false,
      }),
    },
    target: Flags.string({
      char: 's',
      description: "The target instance type. Default 'author'.",
      multiple: false,
      required: true,
      options: ['author', 'publish'],
      default: 'author',
      common: true,
    }),
    scope: Flags.string({
      description: 'Optional filter for the scope.',
      multiple: false,
      required: false,
      default: 'custom',
      options: ['custom', 'product'],
      common: true,
    }),
    include: Flags.string({
      description: 'Optional filter.',
      multiple: false,
      required: false,
      common: true,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format.',
      multiple: false,
      required: false,
      options: ['json'],
    }),
  },
  logInJsonArrayFormat,
};

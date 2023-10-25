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
const { Command, Flags, CliUx } = require('@oclif/core');
const { CloudSdkAPI } = require('../lib/cloud-sdk-api');
const { getToken, context } = require('@adobe/aio-lib-ims');
const Config = require('@adobe/aio-lib-core-config');
const { init } = require('@adobe/aio-lib-cloudmanager');
const jwt = require('jsonwebtoken');
const { codes: configurationCodes } = require('../lib/configuration-errors');
const { codes: validationCodes } = require('../lib/validation-errors');
const { handleError } = require('./error-helpers');

/**
 *
 */
function getCliOrgId() {
  return Config.get('cloudmanager_orgid') || Config.get('console.org.code');
}

/**
 *
 */
function getBaseUrl() {
  const configStr = Config.get('cloudmanager.base_url');
  return configStr || 'https://cloudmanager.adobe.io';
}

/**
 *
 */
async function getTokenAndKey() {
  let accessToken;
  let apiKey;

  try {
    const contextName = 'aio-cli-plugin-cloudmanager';
    accessToken = await getToken(contextName);
    const contextData = await context.get(contextName);
    if (!contextData || !contextData.data) {
      throw new configurationCodes.NO_IMS_CONTEXT({
        messageValues: contextName,
      });
    }
    apiKey = contextData.data.client_id;
  } catch (err) {
    accessToken = await getToken('cli');
    const decodedToken = jwt.decode(accessToken);
    if (!decodedToken) {
      throw new configurationCodes.CLI_AUTH_CONTEXT_CANNOT_DECODE();
    }
    apiKey = decodedToken.client_id;
    if (!apiKey) {
      throw new configurationCodes.CLI_AUTH_CONTEXT_NO_CLIENT_ID();
    }
  }
  return { accessToken, apiKey };
}

/**
 * @param cloudManagerUrl
 * @param orgId
 */
async function initSdk(cloudManagerUrl, orgId) {
  const { accessToken, apiKey } = await getTokenAndKey();
  return await init(orgId, apiKey, accessToken, cloudManagerUrl);
}

class BaseCommand extends Command {
  constructor(argv, config, error) {
    super(argv, config);
    const programId = Config.get('cloudmanager_programid');
    const environmentId = Config.get('cloudmanager_environmentid');
    this._programId = programId;
    this._environmentId = environmentId;
    this.error = error || this.error;
  }

  async catch(err) {
    handleError(err, this.error);
  }

  async getDeveloperConsoleUrl(
    cloudManagerUrl,
    orgId,
    programId,
    environmentId
  ) {
    const sdk = await initSdk(cloudManagerUrl, orgId);
    return sdk.getDeveloperConsoleUrl(programId, environmentId);
  }

  async withCloudSdk(fn) {
    if (!this._cloudSdkAPI) {
      if (!this._programId) {
        throw new validationCodes.MISSING_PROGRAM_ID();
      }
      if (!this._environmentId) {
        throw new validationCodes.MISSING_ENVIRONMENT_ID();
      }
      const { accessToken, apiKey } = await getTokenAndKey();
      const cloudManagerUrl = getBaseUrl();
      const orgId = getCliOrgId();
      const cacheKey = `aem-rde.dev-console-url-cache.cm-p${this._programId}-e${this._environmentId}`;
      let cacheEntry = Config.get(cacheKey);
      // TODO: prune expired cache entries
      if (
        !cacheEntry ||
        new Date(cacheEntry.expiry).valueOf() < Date.now() ||
        !cacheEntry.devConsoleUrl
      ) {
        const developerConsoleUrl = await this.getDeveloperConsoleUrl(
          cloudManagerUrl,
          orgId,
          this._programId,
          this._environmentId
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
        `${cloudManagerUrl}/api/program/${this._programId}/environment/${this._environmentId}`,
        cacheEntry.devConsoleUrl,
        cacheEntry.rdeApiUrl,
        apiKey,
        orgId,
        this._programId,
        this._environmentId,
        accessToken
      );
    }
    return fn(this._cloudSdkAPI);
  }
}

module.exports = {
  BaseCommand,
  Flags,
  cli: CliUx.ux,
  commonArgs: {},
  commonFlags: {
    programId: Flags.string({
      char: 'p',
      description:
        "The programId. If not specified, defaults to 'cloudmanager_programId' config value",
      common: true,
    }),
    environmentId: Flags.string({
      char: 'e',
      description:
        "the environmentId. If not specified, defaults to 'cloudmanager_environmentid' config value",
      common: true,
    }),
    target: Flags.string({
      char: 's',
      description:
        "The target instance type; one of 'author' or 'publish'. If not specified, deployments target both 'author' and 'publish' instances.",
      multiple: false,
      required: false,
      options: ['author', 'publish'],
      common: true,
    }),
  },
  getCliOrgId,
  getBaseUrl,
  initSdk,
};

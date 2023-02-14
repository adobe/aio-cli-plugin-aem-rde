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
const configurationCodes = require('../lib/errors');

/**
 *
 */
function getCliOrgId() {
  return Config.get('cloudmanager_orgid') || Config.get('console.org.code');
}

/**
 * @param item
 */
function toJson(item) {
  let c = item;
  if (typeof c === 'string') {
    c = JSON.parse(c);
  }

  return c;
}

/**
 *
 */
function getBaseUrl() {
  const configStr = Config.get('cloudmanager');
  return (
    (configStr && toJson(configStr).base_url) || 'https://cloudmanager.adobe.io'
  );
}

/**
 *
 */
async function getTokenAndKey(imsContextName) {
  let accessToken;
  let apiKey;

  try {
    accessToken = await getToken(imsContextName);
    const contextData = await context.get(imsContextName);
    if (!contextData || !contextData.data) {
      throw new configurationCodes.NO_IMS_CONTEXT({
        messageValues: imsContextName,
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
 *
 */
async function initSdk() {
  const { accessToken, apiKey } = await getTokenAndKey();
  const orgId = getCliOrgId();
  const baseUrl = getBaseUrl();
  return await init(orgId, apiKey, accessToken, baseUrl);
}

class BaseCommand extends Command {
  async getDeveloperConsoleUrl(programId, environmentId) {
    const sdk = await initSdk();
    return sdk.getDeveloperConsoleUrl(programId, environmentId);
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

  async withCloudSdk(flags, fn) {
    if (!this._cloudSdkAPI) {
      const environmentId = this.getEnvironmentId(flags);
      const programId = this.getProgramId(flags);
      const { accessToken, apiKey } = await getTokenAndKey(
        flags.imsContextName || 'aio-cli-plugin-cloudmanager'
      );
      const cacheKey = `aem-rde.dev-console-url-cache.cm-p${programId}-e${environmentId}`;
      let cacheEntry = Config.get(cacheKey);
      // TODO: prune expired cache entries
      if (
        !cacheEntry ||
        new Date(cacheEntry.expiry).valueOf() < Date.now() ||
        !cacheEntry.devConsoleUrl
      ) {
        const developerConsoleUrl = await this.getDeveloperConsoleUrl(
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
        apiKey,
        getCliOrgId(),
        cacheEntry.devConsoleUrl,
        cacheEntry.rdeApiUrl,
        programId,
        environmentId,
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
    global: {
      imsContextName: Flags.string({
        description:
          'the alternate IMS context name to use instead of aio-cli-plugin-cloudmanager',
        common: true,
      }),
      programId: Flags.string({
        char: 'p',
        description:
          "the programId. If not specified, defaults to 'cloudmanager_programId' config value",
        common: true,
      }),
      environmentId: Flags.string({
        char: 'e',
        description:
          "the environmentId. If not specified, defaults to 'cloudmanager_environmentid' config value",
        common: true,
      }),
    },
    target: Flags.string({
      char: 's',
      description:
        "the target instance type; one of 'author' or 'publish'. If not specified, deployments target both 'author' and 'publish' instances.",
      multiple: false,
      required: false,
      options: ['author', 'publish'],
      common: true,
    }),
  },
};

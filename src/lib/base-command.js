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

// 3rd party dependencies
const { Command, Flags, CliUx } = require('@oclif/core');
const jwt = require('jsonwebtoken');
const inquirer = require('inquirer');
const spinner = require('ora')();
const chalk = require('chalk');
const notifier = require('node-notifier');

// Adobe dependencies
const { getToken, context } = require('@adobe/aio-lib-ims');
const Config = require('@adobe/aio-lib-core-config');
const { init } = require('@adobe/aio-lib-cloudmanager');

// internals
const { CloudSdkAPI } = require('../lib/cloud-sdk-api');
const { concatEnvironemntId } = require('../lib/utils');
const { codes: configurationCodes } = require('../lib/configuration-errors');
const { codes: validationCodes } = require('../lib/validation-errors');
const { handleError } = require('./error-helpers');

class BaseCommand extends Command {
  constructor(argv, config, error) {
    super(argv, config);
    this.error = error || this.error;
  }

  async run() {
    const { args, flags } = await this.parse(this.typeof);
    this.flags = flags;
    this.args = args;
    if (!flags.programId) {
      this._programName = Config.get('cloudmanager_programname');
    }
    if (!flags.environmentId) {
      this._environmentName = Config.get('cloudmanager_environmentname');
    }

    this.setupParams(flags);

    if (
      !flags?.quiet &&
      !flags?.json &&
      this.constructor.name !== 'SetupCommand'
    ) {
      this.doLog(this.getLogHeader());
      const lastAction = Config.get('rde_lastaction');
      if (lastAction && Date.now() - lastAction > 24 * 60 * 60 * 1000) {
        const { executeCommand } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'executeCommand',
            message: `The last RDE command ran more than 24h ago, do you want to continue running the command on ${concatEnvironemntId(this._programId, this._environmentId)}?`,
            default: true,
          },
        ]);
        if (!executeCommand) {
          this.doLog('Command execution aborted.');
          return;
        }
      }
      Config.set('rde_lastaction', Date.now());
    }

    return await this.runCommand(args, flags);
  }

  setupParams(flags) {
    this._orgId = this.readFromFlagsOrDefault(
      flags.organizationId,
      'cloudmanager_orgid'
    );
    this._programId = this.readFromFlagsOrDefault(
      flags.programId,
      'cloudmanager_programid'
    );
    this._environmentId = this.readFromFlagsOrDefault(
      flags.environmentId,
      'cloudmanager_environmentid'
    );
  }

  readFromFlagsOrDefault(input, configKey) {
    const trimmedInput = input ? input.trim() : '';
    return trimmedInput || Config.get(configKey);
  }

  /**
   * the commands run method to be implemented by the sub class
   * @param args the arguments passed to the command
   * @param flags the flags passed to the command
   */
  runCommand(args, flags) {
    throw new Error(
      'You have to implement the method runCommand(args, flags) in the subclass!'
    );
  }

  async catch(err) {
    handleError(err, this.error);
  }

  rdeIdentification() {
    return `${concatEnvironemntId(this._programId, this._environmentId)}${this.printNamesWhenAvailable()}`;
  }

  getLogHeader() {
    return `Running ${!this.id ? this.constructor.name : this.id} on ${this.rdeIdentification()}`;
  }

  printNamesWhenAvailable() {
    if (this._programName && this._environmentName) {
      return ` (${this._programName} - ${this._environmentName})`;
    }
    return '';
  }

  doLog(message, always = false) {
    if (always || !this.flags?.quiet) {
      this.log(message);
    }
  }

  spinnerStart(message) {
    if (!(this.flags?.quiet || this.flags?.json)) {
      spinner.start(message);
    }
  }

  spinnerIsSpinning() {
    return spinner.isSpinning;
  }

  spinnerStop() {
    spinner.stop();
  }

  notify(title, message) {
    if (Config.get('rde_enableNotifications')) {
      title = `${this.rdeIdentification()} - ${title}`;
      notifier.notify({ title, message });
    }
  }

  /**
   *
   */
  getCliOrgId() {
    return Config.get('cloudmanager_orgid') || Config.get('console.org.code');
  }

  /**
   *
   * @param stage
   */
  getBaseUrl(stage) {
    return !stage
      ? 'https://cloudmanager.adobe.io'
      : 'https://cloudmanager-stage.adobe.io';
  }

  /**
   *
   */
  async getTokenAndKey() {
    let contextName =
      this.flags?.context ||
      (await context.getCurrent()) ||
      'aio-cli-plugin-cloudmanager';
    let contextData = await context.get(contextName);

    if (!contextData?.data) {
      if (contextName !== 'aio-cli-plugin-cloudmanager') {
        this.doLog(
          chalk.red(`\nConfigured default context '${contextName}' not found.`),
          true
        );
        throw new configurationCodes.NO_IMS_CONTEXT({
          messageValues: contextName,
        });
      } else {
        contextName = 'cli';
        contextData = await context.get(contextName);
      }
    }

    const local = contextData?.local || false;
    const data = contextData?.data;
    if (!data) {
      throw new configurationCodes.NO_IMS_CONTEXT({
        messageValues: contextName,
      });
    }

    if (contextName === 'aio-cli-plugin-cloudmanager') {
      this.doLog(
        chalk.yellow(
          `\nUsing deprecated context '${contextName}'. Refer to the documentation to update your context: https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/rapid-development-environments#aio-rde-plugin-troubleshooting-deprecatedcontext`
        )
      );
    }

    const accessToken = await getToken(contextName);
    const apiKey = data.client_id
      ? data.client_id
      : jwt.decode(accessToken)?.client_id;
    if (!apiKey) {
      if (!jwt.decode(accessToken)) {
        throw new configurationCodes.CLI_AUTH_CONTEXT_CANNOT_DECODE();
      }
      throw new configurationCodes.CLI_AUTH_CONTEXT_NO_CLIENT_ID();
    }
    return { accessToken, apiKey, local, data };
  }

  /**
   * @param cloudManagerUrl
   * @param orgId
   * @param accessToken
   * @param apiKey
   */
  async initSdk(cloudManagerUrl, orgId, accessToken, apiKey) {
    return await init(orgId, apiKey, accessToken, cloudManagerUrl);
  }

  async getDeveloperConsoleUrl(
    cloudManagerUrl,
    orgId,
    programId,
    environmentId,
    accessToken,
    apiKey
  ) {
    const sdk = await this.initSdk(cloudManagerUrl, orgId, accessToken, apiKey);
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
      const { accessToken, apiKey, data } = await this.getTokenAndKey();
      const cloudManagerUrl = this.getBaseUrl(data?.env === 'stage');
      const orgId = this.getCliOrgId();
      const cacheKey = `aem-rde.dev-console-url-cache.${concatEnvironemntId(this._programId, this._environmentId)}`;
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
          this._environmentId,
          accessToken,
          apiKey
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

  jsonResult(serverStatus) {
    const result = {
      programId: this._programId,
      environmentId: this._environmentId,
      status: serverStatus,
    };
    return result;
  }

  formatElapsedTime(startTime, endTime) {
    const ms = endTime - startTime;
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${(ms / 60000).toFixed(2)}m`;
    }
  }
}

Object.assign(BaseCommand, {
  description: 'Enable json output for all commands by default.',
  enableJsonFlag: true,
  flags: {
    context: Flags.string({
      aliases: ['ctx', 'imsContextName'],
      description: 'The IMS context used to retrieve login information',
      multiple: false,
      required: false,
      helpGroup: 'GLOBAL',
    }),
  },
});

module.exports = {
  BaseCommand,
  Flags,
  cli: CliUx.ux,
  commonArgs: {},
  commonFlags: {
    targetInspect: Flags.string({
      char: 's',
      description: "The target instance type. Default 'author'.",
      multiple: false,
      required: false,
      options: ['author', 'publish'],
      default: 'author',
      common: true,
      helpGroup: 'target',
    }),
    target: Flags.string({
      char: 's',
      description:
        "The target instance type; one of 'author' or 'publish'. If not specified, deployments target both 'author' and 'publish' instances.",
      multiple: false,
      required: false,
      options: ['author', 'publish'],
      common: true,
      helpGroup: 'target',
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
    organizationId: Flags.string({
      description: 'The organization id to use while running this command',
      multiple: false,
      required: false,
      helpGroup: 'target',
    }),
    programId: Flags.string({
      description: 'The program id to use while running this command',
      multiple: false,
      required: false,
      helpGroup: 'target',
    }),
    environmentId: Flags.string({
      description: 'The environment id to use while running this command',
      multiple: false,
      required: false,
      helpGroup: 'target',
    }),
    quiet: Flags.boolean({
      description: 'Generates no log output and asks for no user input',
      char: 'q',
      multiple: false,
      required: false,
      default: false,
      helpGroup: 'output',
    }),
  },
};

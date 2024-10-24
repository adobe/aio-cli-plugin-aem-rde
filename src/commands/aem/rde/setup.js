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

const { BaseCommand, Flags } = require('../../../lib/base-command');
const { CloudSdkAPIBase } = require('../../../lib/cloud-sdk-api-base');
const { codes: validationCodes } = require('../../../lib/validation-errors');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const Config = require('@adobe/aio-lib-core-config');
const { Ims } = require('@adobe/aio-lib-ims');
const inquirer = require('inquirer');
const chalk = require('chalk');
const open = require('open');
const { concatEnvironemntId } = require('../../../lib/utils');

/**
 * The `SetupCommand` class extends the `BaseCommand` class and is used to handle setup related commands.
 * It has methods to get organization ID, program ID, and environment ID.
 *
 * getOrgId: This method is used to get the organization ID. It first retrieves the access token and API key,
 * then fetches the organizations associated with these credentials.
 * If there is only one organization, it selects that one. Otherwise, it prompts the user to select an organization.
 * When thee is no organization available, the user is asked to enter the organization ID manually.
 * getProgramId: This method is used to get the program ID. If the programs are not cached, it retrieves the programs
 * associated with the organization and caches them. It then prompts the user to select a program from the cached list.
 * getEnvironmentId: This method is used to get the environment ID. It retrieves the environments associated with the
 * selected program and prompts the user to select an environment. When there are no environments found for the selected program,
 * the user is asked to choose a different program instead.
 *
 * The `SetupCommand` class is part of a command-line interface and is used to set up the environment for the CLI.
 */

const CONFIG_ORG = 'cloudmanager_orgid';
const CONFIG_PROGRAM = 'cloudmanager_programid';
const CONFIG_ENVIRONMENT = 'cloudmanager_environmentid';
const CONFIG_PROGRAM_NAME = 'cloudmanager_programname';
const CONFIG_ENVIRONMENT_NAME = 'cloudmanager_environmentname';
const LINK_ORGID =
  'https://experienceleague.adobe.com/en/docs/core-services/interface/administration/organizations#concept_EA8AEE5B02CF46ACBDAD6A8508646255';

class SetupCommand extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.programsCached = [];
    this.environmentsCached = [];
  }

  async withCloudSdkBase(fn) {
    if (!this._cloudSdkAPIBase) {
      const { accessToken, apiKey, data } = await this.getTokenAndKey();
      const cloudManagerUrl = this.getBaseUrl(data?.env === 'stage');
      const orgId = this.getCliOrgId();
      if (!orgId) {
        throw new validationCodes.MISSING_ORG_ID();
      }
      this._cloudSdkAPIBase = new CloudSdkAPIBase(
        `${cloudManagerUrl}/api`,
        apiKey,
        orgId,
        accessToken
      );
    }
    return fn(this._cloudSdkAPIBase);
  }

  async getOrganizationsFromIms(accessToken) {
    const { ims } = await Ims.fromToken(accessToken);
    return await ims.getOrganizations(accessToken);
  }

  async getOrganizationsFromToken() {
    try {
      const { accessToken } = await this.getTokenAndKey();
      const organizations = await this.getOrganizationsFromIms(accessToken);
      const orgMap = organizations.reduce((map, org) => {
        map[org.orgName] = org.orgRef.ident + '@' + org.orgRef.authSrc;
        return map;
      }, {});
      return orgMap;
    } catch (err) {
      if (err.code === 'CONTEXT_NOT_CONFIGURED') {
        this.doLog('No IMS context found. Please run `aio login` first.');
      }
      return null;
    }
  }

  async getOrgId() {
    let selectedOrg = null;
    const organizations = await this.getOrganizationsFromToken();
    if (!organizations) {
      return null;
    }
    const nrOfOrganizations = Object.keys(organizations).length;

    if (nrOfOrganizations === 0) {
      selectedOrg = await this.fallbackToManualOrganizationId();
    } else if (nrOfOrganizations === 1) {
      const orgName = Object.keys(organizations)[0];
      const orgId = organizations[orgName];
      this.doLog(`Selected only organization: ${orgName} - ${orgId}`);
      return orgId;
    } else {
      selectedOrg = await this.chooseOrganizationFromList(organizations);
    }
    this.doLog(`Selected organization: ${selectedOrg}`);
    return selectedOrg;
  }

  /* istanbul ignore next */ // ignore as this method as it just congifures inquirer
  async chooseOrganizationFromList(organizations) {
    const orgChoices = Object.entries(organizations).map(([name, id]) => ({
      name: `${name} - ${id}`,
      value: id,
    }));
    const { organizationId } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'organizationId',
        message: 'Please choose an organization (type to filter):',
        pageSize: 30,
        source: async (answersSoFar, input) => {
          input = input || '';
          return orgChoices.filter((choice) =>
            choice.name.toLowerCase().includes(input.toLowerCase())
          );
        },
      },
    ]);
    return organizationId;
  }

  /* istanbul ignore next */ // ignore as this method as it just congifures inquirer and opens a browser
  async fallbackToManualOrganizationId() {
    this.doLog(
      chalk.yellow('Could not find an organization ID automatically.')
    );
    this.doLog(chalk.yellow('Please enter your organization ID manually.'));
    this.doLog(chalk.gray(`See ${LINK_ORGID}`));
    const openLink = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openLink',
        message: 'Would you like to open the link in your browser?',
        default: false,
      },
    ]);
    if (openLink.openLink) {
      open(LINK_ORGID);
    }
    const manualOrgId = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualOrgId',
        message: 'Manual organization ID:',
      },
    ]);
    return manualOrgId.manualOrgId;
  }

  async getProgramId() {
    if (!this.programsCached || this.programsCached?.length === 0) {
      this.spinnerStart('retrieving programs of your organization');
      this.programsCached = await this.withCloudSdkBase((cloudSdkAPI) =>
        cloudSdkAPI.listProgramsIdAndName()
      );
      this.spinnerStop();

      if (!this.programsCached || this.programsCached.length === 0) {
        this.doLog(
          chalk.red('No programs found for the selected organization.')
        );
        return null;
      }
    }

    if (this.programsCached.length === 1) {
      this.doLog(`Selected only program: ${this.programsCached[0].id}`);
      return this.programsCached[0].id;
    }

    const choices = this.programsCached.map((program) => ({
      name: `(${program.id}) ${program.name}`,
      value: program.id,
    }));

    const { prevProgramId } = this.getProgramFromConf();

    const { selectedProgram } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedProgram',
        message: 'Please choose a program (type to filter):',
        default: prevProgramId,
        pageSize: 30,
        source: async (answersSoFar, input) => {
          input = input || '';
          return choices.filter((choice) =>
            choice.name.toLowerCase().includes(input.toLowerCase())
          );
        },
      },
    ]);
    return selectedProgram;
  }

  async getEnvironmentId(selectedProgram) {
    this.spinnerStart(`retrieving environments of program ${selectedProgram}`);
    this.environmentsCached = await this.withCloudSdkBase((cloudSdkAPI) =>
      cloudSdkAPI.listEnvironmentsIdAndName(selectedProgram)
    );
    this.spinnerStop();

    // FIXME this filter must be removed as soon as other types are supported
    this.environmentsCached = this.environmentsCached.filter(
      (env) => env.type === 'rde'
    );

    if (this.environmentsCached.length === 0) {
      this.doLog(
        chalk.red(`No environments found for program ${selectedProgram}`)
      );
      this.doLog('==> Please choose a different program');
      return null;
    }

    if (this.environmentsCached.length === 1) {
      this.doLog(`Selected only environment: ${this.environmentsCached[0].id}`);
      return this.environmentsCached[0].id;
    }

    const choicesEnv = this.environmentsCached.map((env) => ({
      name: `(${env.id}) ${env.type}(${env.status}) - ${env.name}`,
      value: env.id,
    }));

    const { prevEnvId } = this.getEnvironmentFromConf();

    const { selectedEnvironment } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedEnvironment',
        message: 'Please choose an environment (type to filter):',
        default: prevEnvId,
        pageSize: 30,
        source: async (answersSoFar, input) => {
          input = input || '';
          return choicesEnv.filter((choice) =>
            choice.name.toLowerCase().includes(input.toLowerCase())
          );
        },
      },
    ]);
    return selectedEnvironment;
  }

  async runCommand(args, flags) {
    if (flags.show) {
      const orgId = Config.get(CONFIG_ORG);
      const programId = Config.get(CONFIG_PROGRAM);
      const programName = Config.get(CONFIG_PROGRAM_NAME);
      const envId = Config.get(CONFIG_ENVIRONMENT);
      const envName = Config.get(CONFIG_ENVIRONMENT_NAME);

      if (!orgId || !programId || !envId) {
        this.doLog(
          chalk.red(
            'No configuration found. Please run `aio aem:rde:setup` to configure the CLI.'
          )
        );
        return;
      }

      this.doLog(
        `Current configuration: ${concatEnvironemntId(programId, envId)}: ${programName} - ${envName} (organization: ${orgId})`
      );
      return;
    }

    try {
      inquirer.registerPrompt(
        'autocomplete',
        require('inquirer-autocomplete-prompt')
      );

      this.doLog(
        `Setup the CLI configuration necessary to use the RDE commands.`
      );

      const { storeLocal } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'storeLocal',
          message:
            'Do you want to store the information you enter in this setup procedure locally?',
          default: false,
        },
      ]);

      const orgId = await this.getOrgId();
      const prevOrgId = Config.get(CONFIG_ORG);
      Config.set(CONFIG_ORG, orgId, storeLocal);

      let selectedEnvironmentId = null;
      let selectedProgramId = null;
      while (selectedEnvironmentId === null) {
        selectedProgramId = await this.getProgramId();
        if (!selectedProgramId) {
          return;
        }

        selectedEnvironmentId = await this.getEnvironmentId(selectedProgramId);
        if (
          selectedEnvironmentId === null &&
          this.programsCached?.length === 1
        ) {
          this.doLog(
            chalk.red(
              'No program or environment found for the selected organization.'
            )
          );
          return;
        }
      }

      const selectedEnvironmentName = this.environmentsCached.find(
        (e) => e.id === selectedEnvironmentId
      )?.name;
      const selectedProgramName = this.programsCached.find(
        (e) => e.id === selectedProgramId
      )?.name;

      this.doLog(
        chalk.green(
          `Selected ${concatEnvironemntId(selectedProgramId, selectedEnvironmentId)}: ${selectedProgramName} - ${selectedEnvironmentName}`
        )
      );

      const { prevProgramId, prevProgramName } = this.getProgramFromConf();
      const { prevEnvId, prevEnvName } = this.getEnvironmentFromConf();
      Config.set(CONFIG_PROGRAM, selectedProgramId, storeLocal);
      Config.set(CONFIG_ENVIRONMENT, selectedEnvironmentId, storeLocal);

      Config.set(CONFIG_PROGRAM_NAME, selectedProgramName, storeLocal);
      Config.set(CONFIG_ENVIRONMENT_NAME, selectedEnvironmentName, storeLocal);

      this.logPreviousConfig(
        prevOrgId,
        prevProgramId,
        prevProgramName,
        prevEnvId,
        prevEnvName,
        orgId,
        selectedProgramId,
        selectedEnvironmentId
      );

      this.doLog(
        `Setup complete. Use 'aio help aem rde' to see the available commands.`
      );
    } catch (err) {
      this.spinnerStop();
      throwAioError(
        err,
        new internalCodes.UNEXPECTED_API_ERROR({ messageValues: err })
      );
    }
  }

  getEnvironmentFromConf() {
    const id = Config.get(CONFIG_ENVIRONMENT);
    const name = Config.get(CONFIG_ENVIRONMENT_NAME);
    return { prevEnvId: id, prevEnvName: name };
  }

  getProgramFromConf() {
    const id = Config.get(CONFIG_PROGRAM);
    const name = Config.get(CONFIG_PROGRAM_NAME);
    return { prevProgramId: id, prevProgramName: name };
  }

  logPreviousConfig(
    prevOrg,
    prevProgram,
    prevProgramName,
    prevEnv,
    prevEnvName,
    orgId,
    selectedProgram,
    selectedEnvironment
  ) {
    if (prevOrg && prevOrg !== orgId) {
      this.doLog(chalk.gray(`Your previous organization ID was: ${prevOrg}`));
    }
    if (prevProgram && prevProgram !== selectedProgram) {
      this.doLog(
        chalk.gray(
          `Your previous program ID was: ${prevProgram} (name: ${prevProgramName})`
        )
      );
    }
    if (prevEnv && prevEnv !== selectedEnvironment) {
      this.doLog(
        chalk.gray(
          `Your previous environment ID was: ${prevEnv} (name: ${prevEnvName})`
        )
      );
    }
  }
}

Object.assign(SetupCommand, {
  description: 'Do not support json putput for setup command.',
  enableJsonFlag: false,
});

Object.assign(SetupCommand, {
  description: 'Setup the CLI configuration necessary to use the RDE commands.',
  args: [],
  aliases: [],
  flags: {
    show: Flags.boolean({
      description: 'Shows the current configuration of the RDE connection.',
      char: 's',
      multiple: false,
      required: false,
      default: false,
    }),
  },
});

module.exports = SetupCommand;

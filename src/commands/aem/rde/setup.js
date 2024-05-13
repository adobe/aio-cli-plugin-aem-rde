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

const { BaseCommand, cli, commonFlags } = require('../../../lib/base-command');
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

let cachedPrograms = null;
const CONFIG_ENVIRONMENT = 'cloudmanager_environmentid';
const CONFIG_PROGRAM = 'cloudmanager_programid';
const CONFIG_ORG = 'cloudmanager_orgid';
const LINK_ORGID =
  'https://experienceleague.adobe.com/en/docs/core-services/interface/administration/organizations#concept_EA8AEE5B02CF46ACBDAD6A8508646255';
class SetupCommand extends BaseCommand {
  async withCloudSdkBase(fn) {
    if (!this._cloudSdkAPIBase) {
      const { accessToken, apiKey } = await this.getTokenAndKey();
      const cloudManagerUrl = this.getBaseUrl();
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

  /**
   *
   */
  async getOrganizationsFromToken() {
    try {
      const { accessToken } = await this.getTokenAndKey();
      const ims = new Ims();
      const organizations = await ims.getOrganizations(accessToken);
      const orgMap = organizations.reduce((map, org) => {
        map[org.orgName] = org.orgRef.ident + '@' + org.orgRef.authSrc;
        return map;
      }, {});
      return orgMap;
    } catch (err) {
      if (err.code === 'CONTEXT_NOT_CONFIGURED') {
        cli.log('No IMS context found. Please run `aio login` first.');
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
      cli.log(`Selected only organization: ${orgName} - ${orgId}`);
      return orgId;
    } else {
      selectedOrg = await this.chooseOrganizationFromList(organizations);
    }
    cli.log(`Selected organization: ${selectedOrg}`);
    return selectedOrg;
  }

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

  async fallbackToManualOrganizationId() {
    cli.log(chalk.yellow('Could not find an organization ID automatically.'));
    cli.log(chalk.yellow('Please enter your organization ID manually.'));
    cli.log(chalk.gray(`See ${LINK_ORGID}`));
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
    if (!cachedPrograms) {
      this.spinnerStart('retrieving programs of your organization');
      const programs = await this.withCloudSdkBase((cloudSdkAPI) =>
        cloudSdkAPI.listProgramsIdAndName()
      );
      this.spinnerStop();

      if (!programs || programs.length === 0) {
        cli.log(chalk.red('No programs found for the selected organization.'));
        return null;
      }

      const choices = programs.map((program) => ({
        name: `(${program.id}) ${program.name}`,
        value: program.id,
      }));
      cachedPrograms = choices;
    }

    if (cachedPrograms.length === 1) {
      cli.log(`Selected only program: ${cachedPrograms[0].value}`);
      return cachedPrograms[0].value;
    }

    const prevProgram = this.getProgramFromConf();

    const { selectedProgram } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedProgram',
        message: 'Please choose a program (type to filter):',
        default: prevProgram,
        pageSize: 30,
        source: async (answersSoFar, input) => {
          input = input || '';
          return cachedPrograms.filter((choice) =>
            choice.name.toLowerCase().includes(input.toLowerCase())
          );
        },
      },
    ]);
    return selectedProgram;
  }

  async getEnvironmentId(selectedProgram) {
    this.spinnerStart(`retrieving environments of program ${selectedProgram}`);
    let environments = await this.withCloudSdkBase((cloudSdkAPI) =>
      cloudSdkAPI.listEnvironmentsIdAndName(selectedProgram)
    );
    this.spinnerStop();

    // FIXME this filter must be removed as soon as other types are supported
    environments = environments.filter((env) => env.type === 'rde');

    if (environments.length === 0) {
      cli.log(
        chalk.red(`No environments found for program ${selectedProgram}`)
      );
      cli.log('==> Please choose a different program');
      return null;
    }

    if (environments.length === 1) {
      cli.log(`Selected only environment: ${environments[0].id}`);
      return environments[0].id;
    }

    const choicesEnv = environments.map((env) => ({
      name: `(${env.id}) ${env.type}(${env.status}) - ${env.name}`,
      value: env.id,
    }));

    const prevEnv = this.getEnvironmentFromConf();

    const { selectedEnvironment } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedEnvironment',
        message: 'Please choose an environment (type to filter):',
        default: prevEnv,
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
    try {
      inquirer.registerPrompt(
        'autocomplete',
        require('inquirer-autocomplete-prompt')
      );

      cli.log(`Setup the CLI configuration necessary to use the RDE commands.`);

      const storeLocal = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'storeLocal',
          message:
            'Do you want to store the information you enter in this setup procedure locally?',
          default: false,
        },
      ]);

      const orgId = await this.getOrgId();
      const prevOrg = Config.get(CONFIG_ORG);
      Config.set(CONFIG_ORG, orgId, storeLocal.storeLocal);

      let selectedEnvironment = null;
      let selectedProgram = null;
      while (selectedEnvironment === null) {
        selectedProgram = await this.getProgramId();
        if (!selectedProgram) {
          return;
        }

        selectedEnvironment = await this.getEnvironmentId(selectedProgram);
        if (selectedEnvironment === null && cachedPrograms?.length === 1) {
          cli.log(
            chalk.red(
              'No program or environment found for the selected organization.'
            )
          );
          return;
        }
      }

      cli.log(
        chalk.green(
          `Selected ${concatEnvironemntId(selectedProgram, selectedEnvironment)}`
        )
      );

      const prevProgram = this.getProgramFromConf();
      const prevEnv = this.getEnvironmentFromConf();
      Config.set(CONFIG_PROGRAM, selectedProgram, storeLocal.storeLocal);
      Config.set(
        CONFIG_ENVIRONMENT,
        selectedEnvironment,
        storeLocal.storeLocal
      );

      this.logPreviousConfig(
        prevOrg,
        prevProgram,
        prevEnv,
        orgId,
        selectedProgram,
        selectedEnvironment
      );

      cli.log(
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
    return Config.get(CONFIG_ENVIRONMENT);
  }

  getProgramFromConf() {
    return Config.get(CONFIG_PROGRAM);
  }

  logPreviousConfig(
    prevOrg,
    prevProgram,
    prevEnv,
    orgId,
    selectedProgram,
    selectedEnvironment
  ) {
    if (prevOrg && prevOrg !== orgId) {
      cli.info(chalk.gray(`Your previous organization ID was: ${prevOrg}`));
    }
    if (prevProgram && prevProgram !== selectedProgram) {
      cli.info(chalk.gray(`Your previous program ID was: ${prevProgram}`));
    }
    if (prevEnv && prevEnv !== selectedEnvironment) {
      cli.info(chalk.gray(`Your previous environment ID was: ${prevEnv}`));
    }
  }
}

Object.assign(SetupCommand, {
  description: 'Setup the CLI configuration necessary to use the RDE commands.',
  args: [],
  aliases: [],
  flags: {
    cicd: commonFlags.cicd,
  },
});

module.exports = SetupCommand;

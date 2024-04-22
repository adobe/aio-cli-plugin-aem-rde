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

const {
  BaseCommand,
  cli,
  getTokenAndKey,
} = require('../../../lib/base-command');
const { codes: internalCodes } = require('../../../lib/internal-errors');
const { throwAioError } = require('../../../lib/error-helpers');
const Config = require('@adobe/aio-lib-core-config');
const inquirer = require('inquirer');
const spinner = require('ora')();
const chalk = require('chalk');
const LibConsoleCLI = require('@adobe/aio-cli-lib-console');

/**
 * The `SetupCommand` class extends the `BaseCommand` class and is used to handle setup related commands.
 * It has methods to get organization ID, program ID, and environment ID.
 *
 * @function getOrgId: This method is used to get the organization ID. It first retrieves the access token and API key,
 * then initializes the consoleCLI with these credentials. It then fetches the organizations associated with these credentials.
 * If there is only one organization, it selects that one. Otherwise, it prompts the user to select an organization.
 * @function getProgramId: This method is used to get the program ID. If the programs are not cached, it retrieves the programs
 * associated with the organization and caches them. It then prompts the user to select a program from the cached list.
 * @function getEnvironmentId: This method is used to get the environment ID. It retrieves the environments associated with the
 * selected program and prompts the user to select an environment. When there are no environments found for the selected program,
 * the user is asked to choose a different program instead.
 *
 * The `SetupCommand` class is part of a command-line interface and is used to set up the environment for the CLI.
 */

let cachedPrograms = null;
class SetupCommand extends BaseCommand {
  async getOrgId() {
    const { accessToken, apiKey } = await getTokenAndKey();
    const consoleCLI = await LibConsoleCLI.init({
      accessToken,
      apiKey,
    });
    const organizations = await consoleCLI.getOrganizations();
    if (organizations.length === 1) {
      cli.log(`Selected only organization: ${organizations[0].code}`);
      return organizations[0].code;
    }
    const org = await consoleCLI.promptForSelectOrganization(organizations);
    cli.log(`Selected organization: ${org.code}`);
    return org.code;
  }

  async getProgramId() {
    if (!cachedPrograms) {
      spinner.start('retrieving programs of your organization');
      const programs = await this.withCloudSdkBase((cloudSdkAPI) =>
        cloudSdkAPI.listProgramsIdAndName()
      );
      spinner.stop();

      const choices = programs.map((program) => ({
        name: `(${program.id}) ${program.name}`,
        value: program.id,
      }));
      cachedPrograms = choices;
    }

    const { selectedProgram } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedProgram',
        message: 'Please choose a program (type to filter):',
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
    spinner.start(`retrieving environments of program ${selectedProgram}`);
    let environments = await this.withCloudSdkBase((cloudSdkAPI) =>
      cloudSdkAPI.listEnvironmentsIdAndName(selectedProgram)
    );
    spinner.stop();

    // FIXME this filter must be removed as soon as other types are supported
    environments = environments.filter((env) => env.type === 'rde');

    if (environments.length === 0) {
      cli.log(
        chalk.red(`No environments found for program ${selectedProgram}`)
      );
      cli.log('==> Please choose a different program');
      return null;
    }

    const choicesEnv = environments.map((env) => ({
      name: `(${env.id}) ${env.type}(${env.status}) - ${env.name}`,
      value: env.id,
    }));

    const { selectedEnvironment } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedEnvironment',
        message: 'Please choose an environment (type to filter):',
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

  async run() {
    try {
      cli.log(`Setup the CLI configuration necessary to use the RDE commands.`);

      const storeLocal = await cli.confirm(
        'Do you want to store the information you enter in this setup procedure locally? (yes/no)'
      );

      const orgId = await this.getOrgId();
      const prevOrg = Config.get('cloudmanager_orgid');
      Config.set('cloudmanager_orgid', orgId, storeLocal);

      inquirer.registerPrompt(
        'autocomplete',
        require('inquirer-autocomplete-prompt')
      );

      let selectedEnvironment = null;
      let selectedProgram = null;
      while (selectedEnvironment === null) {
        selectedProgram = await this.getProgramId();
        selectedEnvironment = await this.getEnvironmentId(selectedProgram);
      }

      cli.log(
        chalk.green(`Selected p${selectedProgram}-e${selectedEnvironment}`)
      );

      const prevProgram = Config.get('cloudmanager_programid');
      const prevEnv = Config.get('cloudmanager_environmentid');
      Config.set('cloudmanager_programid', selectedProgram, storeLocal);
      Config.set('cloudmanager_environmentid', selectedEnvironment, storeLocal);

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
      spinner.stop();
      throwAioError(
        err,
        new internalCodes.UNEXPECTED_API_ERROR({ messageValues: err })
      );
    }
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
      cli.info(chalk.gray(`Your previous organization id was: ${prevOrg}`));
    }
    if (prevProgram && prevProgram !== selectedProgram) {
      cli.info(chalk.gray(`Your previous program id was: ${prevProgram}`));
    }
    if (prevEnv && prevEnv !== selectedEnvironment) {
      cli.info(chalk.gray(`Your previous environment id was: ${prevEnv}`));
    }
  }
}

Object.assign(SetupCommand, {
  description: 'Setup the CLI configuration necessary to use the RDE commands.',
  args: [],
  aliases: [],
});

module.exports = SetupCommand;

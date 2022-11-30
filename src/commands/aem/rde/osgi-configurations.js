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

class OsgiConfigurationsCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(OsgiConfigurationsCommand);
    try {
      if (!args.pId) {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiConfigurations(flags.target)
        );
        if (response.status === 200) {
          let json = await response.json();
          cli.log('- Osgi Configurations: ');
          json.items.forEach((osgiConfiguration) => {
            cli.log(osgiConfiguration);
          });
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      } else {
        let response = await this.withCloudSdk((cloudSdkAPI) =>
          cloudSdkAPI.getOsgiConfiguration(flags.target, args.pId)
        );
        if (response.status === 200) {
          let osgiConfiguration = await response.json();
          cli.log(`- Osgi Configuration "${args.pId}": `);
          cli.log(osgiConfiguration);
        } else {
          cli.log(`Error: ${response.status} - ${response.statusText}`);
        }
      }
    } catch (err) {
      cli.log(err);
    }
  }
}

Object.assign(OsgiConfigurationsCommand, {
  description:
    'Get the list of osgi-configurations for the target of a rapid development environment.',
  args: [
    {
      name: 'pId',
      description: 'The PID of the osgi-configuration to get.',
    },
  ],
  flags: {
    target: commonFlags.target,
  },
});

module.exports = OsgiConfigurationsCommand;

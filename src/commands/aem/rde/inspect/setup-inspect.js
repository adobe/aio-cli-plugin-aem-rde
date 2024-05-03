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

const jwt = require('jsonwebtoken');
const Config = require('@adobe/aio-lib-core-config');
const {
  codes: configurationCodes,
} = require('../../../../lib/configuration-errors');
const { InspectBaseCommand } = require('../../../../lib/inspect-base-command');

/**
 * All commands under the `inspect` topic need a additional accessToken, to get access on the aem instance.
 * This token can be generated in the Skyline Developer Console. (Tabs: Integrations > Local Token)
 * With this command the token gets written into the config for later use.
 */
class SetupInspectCommand extends InspectBaseCommand {
  async run() {
    const { args } = await this.parse(SetupInspectCommand);
    const imsToken = { token: args.accessToken };

    const decodedToken = jwt.decode(imsToken.token);
    if (!decodedToken) {
      throw new configurationCodes.CLI_AUTH_CONTEXT_CANNOT_DECODE();
    }

    // Calculate exact moment of expiry
    const expiry =
      parseInt(decodedToken?.created_at) + parseInt(decodedToken?.expires_in);
    if (!expiry) {
      throw new configurationCodes.TOKEN_HAS_NO_EXPIRY();
    }

    // Checks if token is expired
    if (!(typeof expiry === 'number' && expiry > Date.now())) {
      throw new configurationCodes.TOKEN_IS_EXPIRED();
    }
    imsToken.expiry = expiry;

    // Writes token and expire date in config for inspect comand authorisation process
    Config.set('aem-rde.inspect.ims_access_token', imsToken);
  }
}

Object.assign(SetupInspectCommand, {
  description: 'Set the authorization token for all the inpect comands.',
  args: [
    {
      name: 'accessToken',
      description:
        'Authorization access token from the Skyline Developer Console. (`aio cloudmanager:environment:open-developer-console` > Integrations > Local Token)',
    },
  ],
});

module.exports = SetupInspectCommand;

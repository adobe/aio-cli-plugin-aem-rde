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

const { BaseCommand, Flags } = require('../../../../lib/base-command');
const { CloudSdkAPIBase } = require('../../../../lib/cloud-sdk-api-base');
const { codes: validationCodes } = require('../../../../lib/validation-errors');
const { codes: internalCodes } = require('../../../../lib/internal-errors');
const { throwAioError } = require('../../../../lib/error-helpers');
const chalk = require('chalk');
const { concatEnvironemntId } = require('../../../../lib/utils');

class CreateSnapshots extends BaseCommand {
  constructor(argv, config) {
    super(argv, config);
    this.programsCached = [];
    this.environmentsCached = [];
  }

  async runCommand(args, flags) {
    this.log('Implement create snapshot...');
  }
}

Object.assign(CreateSnapshots, {
  description:
    'Creates a snapshot of the current state of the environment, includes content and deployment.',
  args: [],
  aliases: [],
  flags: {
    description: Flags.string({
      description: 'A brief description of the snapshot.',
      char: 'd',
      multiple: false,
      required: false,
    }),
  },
});

module.exports = CreateSnapshots;

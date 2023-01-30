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

const { BaseCommand, cli, commonFlags, Flags } = require('../../../lib/base-command')
const {loadUpdateHistory} = require('../../../lib/rde-utils');
const {loadAllArtifacts, groupArtifacts} = require("../../../lib/rde-utils");
const spinner = require('ora')();

class DeleteCommand extends BaseCommand {
  async run() {
    const { args, flags } = await this.parse(DeleteCommand)
    try {
      let services = !flags.target ? ['author', 'publish'] : [flags.target ]
      let types = !flags.type ? ['osgi-bundle', 'osgi-config'] : [flags.type]
      let filters = {
        'osgi-bundle': bundle => bundle.metadata.bundleSymbolicName === args.id ||
          `${bundle.metadata.bundleSymbolicName}-${bundle.metadata.bundleVersion}` === args.id,
        'osgi-config': config => config.metadata.configPid === args.id
      }

      spinner.start(`deleting ${args.id}`);
      let status = await this.withCloudSdk(cloudSdkAPI => loadAllArtifacts(cloudSdkAPI))
      let grouped = groupArtifacts(status.items)
      let artifacts = [];
      for (let target of services) {
        for (let type of types) {
          artifacts.push(...grouped[target][type].filter(filters[type]))
        }
      }

      for (let artifact of artifacts) {
        let change = await this.withCloudSdk(cloudSdkAPI => cloudSdkAPI.delete(artifact.id, flags.force));
        await this.withCloudSdk(cloudSdkAPI => loadUpdateHistory(
            cloudSdkAPI,
            change.updateId,
            cli,
            (done, text) => done ? spinner.stop() : spinner.start(text)
        ));
      }
      spinner.stop();

      if (artifacts.length === 0) {
        let typeInfo = types.length === 1 ? types[0] : 'artifact'
        let serviceInfo = services.length === 1 ? `the ${services[0]} of ` : ''
        cli.log(`Could not delete ${typeInfo} "${args.id}". It is not present on ${serviceInfo}this environment.`)
      }
    } catch (err) {
      spinner.stop()
      cli.log(err);
    }
  }
}

Object.assign(DeleteCommand, {
  description: 'Delete bundles and configs from the current rde.',
  args: [{
    name: 'id',
    description: 'the id (bsn or pid) to delete',
    multiple: false,
    required: true
    }],
  flags: {
    target: commonFlags.target,
    type: Flags.string({
      char: 't',
      description: 'the type (osgi-bundle|osgi-config)',
      multiple: false,
      required: false,
      options: [
        'osgi-config',
        'osgi-bundle']
    }),
    force: Flags.boolean({
      char: 'f',
      multiple: false,
      required: false
    })
  },
  aliases: [],
})

module.exports = DeleteCommand

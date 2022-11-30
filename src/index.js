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

const DeleteCommand = require('./commands/aem/rde/delete')
const HistoryCommand = require('./commands/aem/rde/history')
const InstallCommand = require('./commands/aem/rde/install')
const StatusCommand = require('./commands/aem/rde/status')
const LogsCommand = require('./commands/aem/rde/logs/index')
const CreateLogsCommand = require('./commands/aem/rde/logs/create')
const DeleteLogsCommand = require('./commands/aem/rde/logs/delete')
const RequestLogsCommand = require('./commands/aem/rde/request-logs/index')
const EnableRequestLogsCommand = require('./commands/aem/rde/request-logs/enable')
const DisableRequestLogsCommand = require('./commands/aem/rde/request-logs/delete')
const InventoryCommand = require('./commands/aem/rde/inventory')
const OsgiBundlesCommand = require('./commands/aem/rde/osgi-bundles')
const OsgiComponentsCommand = require('./commands/aem/rde/osgi-components')
const OsgiConfigurationsCommand = require('./commands/aem/rde/osgi-configurations')
const OsgiServicesCommand = require('./commands/aem/rde/osgi-services')
const SlingRequestsCommand = require('./commands/aem/rde/sling-requests')

module.exports = {
  'delete': new DeleteCommand().run,
  'history': new HistoryCommand().run,
  'install': new InstallCommand().run,
  'status': new StatusCommand().run,
  'logs': new LogsCommand().run,
  'logs:create': new CreateLogsCommand().run,
  'logs:delete': new DeleteLogsCommand().run,
  'request-logs': new RequestLogsCommand().run,
  'request-logs:enable': new EnableRequestLogsCommand().run,
  'request-logs:disable': new DisableRequestLogsCommand().run,
  'inventory': new InventoryCommand().run,
  'osgi-bundles': new OsgiBundlesCommand().run,
  'osgi-components': new OsgiComponentsCommand().run,
  'osgi-configurations': new OsgiConfigurationsCommand().run,
  'osgi-services': new OsgiServicesCommand().run,
  'sling-requests': new SlingRequestsCommand().run,
}

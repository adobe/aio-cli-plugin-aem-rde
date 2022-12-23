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

const DeleteCommand = require('./commands/aem/rde/delete');
const HistoryCommand = require('./commands/aem/rde/history');
const InstallCommand = require('./commands/aem/rde/install');
const StatusCommand = require('./commands/aem/rde/status');
const LogsCommand = require('./commands/aem/rde/inspect/logs/index');
const CreateLogsCommand = require('./commands/aem/rde/inspect/logs/create');
const DeleteLogsCommand = require('./commands/aem/rde/inspect/logs/delete');
const RequestLogsCommand = require('./commands/aem/rde/inspect/request-logs/index');
const EnableRequestLogsCommand = require('./commands/aem/rde/inspect/request-logs/enable');
const DisableRequestLogsCommand = require('./commands/aem/rde/inspect/request-logs/delete');
const InventoryCommand = require('./commands/aem/rde/inspect/inventory');
const OsgiBundlesCommand = require('./commands/aem/rde/inspect/osgi-bundles');
const OsgiComponentsCommand = require('./commands/aem/rde/inspect/osgi-components');
const OsgiConfigurationsCommand = require('./commands/aem/rde/inspect/osgi-configurations');
const OsgiServicesCommand = require('./commands/aem/rde/inspect/osgi-services');
const SlingRequestsCommand = require('./commands/aem/rde/inspect/sling-requests');

module.exports = {
  'delete': new DeleteCommand().run,
  'history': new HistoryCommand().run,
  'install': new InstallCommand().run,
  'status': new StatusCommand().run,
  'inspect:logs': new LogsCommand().run,
  'inspect:logs:create': new CreateLogsCommand().run,
  'inspect:logs:delete': new DeleteLogsCommand().run,
  'inspect:request-logs': new RequestLogsCommand().run,
  'inspect:request-logs:enable': new EnableRequestLogsCommand().run,
  'inspect:request-logs:disable': new DisableRequestLogsCommand().run,
  'inspect:inventory': new InventoryCommand().run,
  'inspect:osgi-bundles': new OsgiBundlesCommand().run,
  'inspect:osgi-components': new OsgiComponentsCommand().run,
  'inspect:osgi-configurations': new OsgiConfigurationsCommand().run,
  'inspect:osgi-services': new OsgiServicesCommand().run,
  'inspect:sling-requests': new SlingRequestsCommand().run,
};

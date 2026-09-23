/*
 * Copyright 2023 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const { ErrorWrapper, createUpdater } =
  require('@adobe/aio-lib-core-errors').AioCoreSDKErrorWrapper;

const codes = {};
const messages = new Map();

/**
 * Create an Updater for the Error wrapper
 *
 * @ignore
 */
const Updater = createUpdater(
  // object that stores the error classes (to be exported)
  codes,
  // Map that stores the error strings (to be exported)
  messages
);

/**
 * Provides a wrapper to easily create classes of a certain name, and values
 *
 * @ignore
 */
const E = ErrorWrapper(
  // The class name for your SDK Error. Your Error objects will be these objects
  'RDECLIInternalError',
  // The name of your SDK. This will be a property in your Error objects
  'RDECLI',
  // the object returned from the CreateUpdater call above
  Updater
  // the base class that your Error class is extending. AioCoreSDKError is the default
  /* AioCoreSDKError, */
);

module.exports = {
  codes,
  messages,
};

// Define your error codes with the wrapper
E('NAMESPACE_NOT_FOUND', 'No namespace was found.');
E('ENVIRONMENT_NOT_HIBERNATED', 'No namespace was found.');
E('ENVIRONMENT_NOT_RUNNING', 'No namespace was found.');
E(
  'NETWORK_ERROR',
  'Could not communicate with the server on %s. This may be caused by a network, proxy, or TLS issue. x-request-id: %s. Please, try again later and if the error persists, report it along with the x-request-id.'
);
E(
  'UNEXPECTED_API_ERROR',
  'There was an unexpected API error code %s with message %s. Please, try again later and if the error persists, report it.'
);
E(
  'HTTP_ERROR',
  'The request to %s failed with HTTP status %s %s. x-request-id: %s. Please, try again later and if the error persists, report it along with the x-request-id.'
);
E(
  'CONNECTION_ERROR',
  'Could not connect to %s: %s (%s). x-request-id: %s. The request never reached the server, which usually points to a network, proxy or VPN issue. If you are behind a corporate proxy, make sure HTTPS_PROXY (and NO_PROXY, if applicable) are set for this shell. Please, try again later and if the error persists, report it along with the x-request-id.'
);
E(
  'TLS_ERROR',
  'The TLS connection to %s failed: %s (%s). x-request-id: %s. This usually means HTTPS traffic is being intercepted by a proxy that presents a certificate Node.js does not trust. Note that Node.js does not use the operating system certificate store, so a certificate trusted by your browser still has to be provided separately: ask your IT team for the corporate root CA certificate and point NODE_EXTRA_CA_CERTS at it (for example NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.pem) before running the command again.'
);
E(
  'INTERNAL_REQUEST_LOGS_DISABLE_ERROR',
  'There was an unexpected error when running request logs command disable option. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_REQUEST_LOGS_ENABLE_ERROR',
  'There was an unexpected error when running request logs command enable option. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_REQUEST_LOGS_ERROR',
  'There was an unexpected error when running request logs command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_INVENTORY_ERROR',
  'There was an unexpected error when running inventory command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_GET_LOG_ERROR',
  'There was an unexpected error when running get log command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_DELETE_LOG_ERROR',
  'There was an unexpected error when running delete log command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_CREATE_LOG_ERROR',
  'There was an unexpected error when running create log command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_CREATE_LOG_TOO_MANY_LOGS_ERROR',
  'There are too many log configurations. Please, delete some logs before creating new ones.'
);
E(
  'INTERNAL_GET_OSGI_BUNDLES_ERROR',
  'There was an unexpected error when running get osgi bundles command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_GET_OSGI_COMPONENTS_ERROR',
  'There was an unexpected error when running get osgi components command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_GET_OSGI_CONFIGURATIONS_ERROR',
  'There was an unexpected error when running get osgi configurations command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_GET_OSGI_SERVICES_ERROR',
  'There was an unexpected error when running get osgi services command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_GET_SLING_REQUESTS_ERROR',
  'There was an unexpected error when running get sling requests command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_SNAPSHOT_ERROR',
  'There was an unexpected error when running a snapshot command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_DELETE_ERROR',
  'There was an unexpected error when running delete command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_HISTORY_ERROR',
  'There was an unexpected error when running history command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_INSTALL_ERROR',
  'There was an unexpected error when running install command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_RESET_ERROR',
  'There was an unexpected error when running reset command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_CLEAN_ERROR',
  'There was an unexpected error when running clean command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_RESTART_ERROR',
  'There was an unexpected error when running restart command. Please, try again later and if the error persists, report it. Error %s'
);
E(
  'INTERNAL_STATUS_ERROR',
  'There was an unexpected error when running status command. Please, try again later and if the error persists, report it. Error %s'
);
E('UNKNOWN', 'An unknown error occurred.');
E(
  'INVALID_STATE',
  'The RDE is not in a state where the command can be executed.'
);

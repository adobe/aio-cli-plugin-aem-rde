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
  'RDE_CLI_ConfigurationError',
  // The name of your SDK. This will be a property in your Error objects
  'RDE_CLI',
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
E('NO_IMS_CONTEXT', 'Unable to find IMS context %s.');
E(
  'CLI_AUTH_CONTEXT_CANNOT_DECODE',
  'The access token configured for cli authentication cannot be decoded.'
);
E(
  'CLI_AUTH_CONTEXT_NO_CLIENT_ID',
  'The decoded access token configured for cli authentication does not have a client_id.'
);

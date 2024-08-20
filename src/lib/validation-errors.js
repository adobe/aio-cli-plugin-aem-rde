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
  'RDECLIValidationError',
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
E('UNSUPPORTED_PROTOCOL', 'Protocol %s is not supported.');
E(
  'INVALID_GUESS_TYPE',
  'We could not infer the deployment type. Please specify the -t option with one of the following types: %s'
);
E(
  'MISSING_CONTENT_PATH',
  'When using a content-file or content-xml option, you must also specify the path flag.'
);
E(
  'MISSING_ORG_ID',
  'Organization ID must be specified through cloudmanager_orgid config value.'
);
E(
  'MISSING_PROGRAM_ID',
  'Program ID must be specified either as --programId flag or through cloudmanager_programid config value.'
);
E(
  'MISSING_ENVIRONMENT_ID',
  'Environment ID must be specified either as --environmentId flag or through cloudmanager_environmentid config value.'
);
E(
  'INVALID_UPDATE_ID',
  'Invalid update ID "%s". Please use a positive update ID number as the input.'
);
E(
  'CONCURRENT_MODIFICATION',
  'Your RDE is waiting for the upload of a previous invocation of the "install" command. You can ignore this by using the "--force" flag.'
);
E(
  'DEPLOYMENT_IN_PROGRESS',
  'AEM instances are receiving a deployment and new packages are not accepted temporarily until the instances are done.'
);
/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { AioError } = require('./errors');
const { CliUx } = require('@oclif/core');
const exitCodes = {
  GENERAL: 1,
  CONFIGURATION: 2,
  VALIDATION: 3,
  DEPLOYMENT_ERROR: 4,
  INTERNAL: 5,
  DEPLOYMENT_WARNING: 40,
};

/**
 * @param _error
 * @param errorFn
 */
function handleError(_error, errorFn) {
  if (CliUx.ux.action.running) {
    CliUx.ux.action.stop('failed');
  }

  let exitCode = exitCodes.GENERAL;
  switch (_error.name) {
    case 'RDECLIDeploymentError':
      exitCode = exitCodes.DEPLOYMENT_ERROR;
      break;
    case 'RDECLIDeploymentWarning':
      exitCode = exitCodes.DEPLOYMENT_WARNING;
      break;
    case 'RDECLIInternalError':
      exitCode = exitCodes.INTERNAL;
      break;
    case 'RDECLIValidationError':
      exitCode = exitCodes.VALIDATION;
      break;
    case 'RDECLIConfigurationError':
      exitCode = exitCodes.CONFIGURATION;
      break;
  }

  errorFn(_error.message, {
    code: _error.code,
    exit: exitCode,
  });
}

/**
 * @param aioErr
 * @param defaultErr
 */
function throwAioError(aioErr, defaultErr) {
  if (aioErr instanceof AioError) {
    throw aioErr;
  }

  throw defaultErr;
}

module.exports = {
  handleError,
  throwAioError,
  exitCodes,
};

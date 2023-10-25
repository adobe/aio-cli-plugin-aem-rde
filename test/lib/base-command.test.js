// /*
// Copyright 2023 Adobe. All rights reserved.
// This file is licensed to you under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may obtain a copy
// of the License at http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software distributed under
// the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
// OF ANY KIND, either express or implied. See the License for the specific language
// governing permissions and limitations under the License.
// */

const { CliUx } = require('@oclif/core');
const { BaseCommand, cli } = require('../../src/lib/base-command');
const { exitCodes } = require('../../src/lib/error-helpers');
const { codes: configurationCodes } = require('../../src/lib/configuration-errors');
const { codes: deploymentErrorCodes } = require('../../src/lib/deployment-errors');
const { codes: deploymentWarningCodes } = require('../../src/lib/deployment-warnings');
const { codes: internalCodes } = require('../../src/lib/internal-errors');
const { codes: validationCodes } = require('../../src/lib/validation-errors');
const assert = require('assert');
const sinon = require('sinon').createSandbox();
const { setupLogCapturing } = require('../util.js');


describe('BaseCommand catch errors', function () {
    let errorSpy;
    let command;

    setupLogCapturing(sinon, cli);

    before(() => sinon.useFakeTimers());
    after(() => sinon.restore());

    beforeEach(() => {
        const errorFn = () => { }
        errorSpy = sinon.spy(errorFn)
        command = new BaseCommand(undefined, undefined, errorSpy)
    });
    afterEach(async () => {
        delete CliUx.ux.action.running
    });

    it('Catch -- generic (no action running)', async function () {
        const err = new Error('msg');
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.GENERAL,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

    it('Catch -- RDECLIConfigurationError', async function () {
        const err = new configurationCodes.TOKEN_IS_EXPIRED();
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.CONFIGURATION,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

    it('Catch -- RDECLIDeploymentError', async function () {
        const err = new deploymentErrorCodes.INSTALL_FAILED();
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.DEPLOYMENT_ERROR,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

    it('Catch -- RDECLIDeploymentWarning', async function () {
        const err = new deploymentWarningCodes.INSTALL_STAGED();
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.DEPLOYMENT_WARNING,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

    it('Catch -- RDECLIInternalError', async function () {
        const err = new internalCodes.UNEXPECTED_API_ERROR({
            messageValues: [500, "test"],
        });
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.INTERNAL,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

    it('Catch -- RDECLIValidationError', async function () {
        const err = new validationCodes.MISSING_PROGRAM_ID();
        await command.catch(err);
        assert.equal(errorSpy.calledOnce, true, 'Error function should be called once');
        const errorFnExpectedArgs = [err.message, {
            code: err.code,
            exit: exitCodes.VALIDATION,
        }];
        assert(errorSpy.calledWith(...errorFnExpectedArgs),
            `Error function was called with arguments ${errorSpy.getCall(-1)} but it was expected ${JSON.stringify(errorFnExpectedArgs)}`);
    });

});

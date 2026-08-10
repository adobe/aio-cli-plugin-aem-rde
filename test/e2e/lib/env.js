'use strict';

const { resolveWorkspaceDir, readLocalAioConfig } = require('./workspace');

/**
 * Local, opt-in E2E test gate.
 *
 * These tests run real CLI commands against a real (disposable/scratch) RDE
 * environment - including snapshot restore/delete which mutate real content
 * and lock the RDE while running. They must never run implicitly, so every
 * required value below has to be explicitly provided by the developer.
 *
 * Note: the snapshot commands (create/restore/delete/undelete/list) don't
 * declare --programId/--environmentId/--organizationId flags at all (only
 * `status` does) - they can only ever target whatever is in persisted aio
 * config (cloudmanager_programid/cloudmanager_environmentid). So instead of
 * passing RDE_E2E_PROGRAM_ID/RDE_E2E_ENVIRONMENT_ID as flags, this module
 * asserts they match the already-persisted config in the resolved E2E
 * workspace directory (see workspace.js) - both as the only way to make
 * snapshot commands target the right place, and as an extra safety check
 * against accidentally running against the wrong environment.
 *
 * See README.md "End-to-end (E2E) testing" for the one-time setup
 * (aio login, config, experimental-feature enablement + disclaimer
 * acceptance) that has to happen before these tests can do anything useful.
 */
function getE2EConfig() {
  const expectedProgramId = process.env.RDE_E2E_PROGRAM_ID;
  const expectedEnvironmentId = process.env.RDE_E2E_ENVIRONMENT_ID;
  const confirmed = process.env.RDE_E2E_CONFIRM === 'yes';

  const missing = [];
  if (!expectedProgramId) missing.push('RDE_E2E_PROGRAM_ID');
  if (!expectedEnvironmentId) missing.push('RDE_E2E_ENVIRONMENT_ID');
  if (!confirmed) missing.push('RDE_E2E_CONFIRM=yes');

  if (missing.length > 0) {
    return {
      enabled: false,
      reason:
        `Skipping E2E tests - missing/unset: ${missing.join(', ')}. ` +
        'See README.md "End-to-end (E2E) testing" for setup instructions.',
    };
  }

  const workspaceDir = resolveWorkspaceDir();
  const localConfig = readLocalAioConfig(workspaceDir);
  const configuredProgramId = localConfig.cloudmanager_programid;
  const configuredEnvironmentId = localConfig.cloudmanager_environmentid;
  if (
    String(configuredProgramId) !== String(expectedProgramId) ||
    String(configuredEnvironmentId) !== String(expectedEnvironmentId)
  ) {
    return {
      enabled: false,
      reason:
        `Skipping E2E tests - the local config at ${workspaceDir}/.aio ` +
        `(cloudmanager_programid=${configuredProgramId}, cloudmanager_environmentid=${configuredEnvironmentId}) ` +
        `does not match RDE_E2E_PROGRAM_ID/RDE_E2E_ENVIRONMENT_ID (${expectedProgramId}/${expectedEnvironmentId}). ` +
        'Run `aio aem:rde:setup` (or `aio config:set -l cloudmanager_programid/cloudmanager_environmentid`) ' +
        `from ${workspaceDir} to point it at the RDE_E2E_* environment first.`,
    };
  }

  const commonFlags = process.env.RDE_E2E_CONTEXT
    ? ['--context', process.env.RDE_E2E_CONTEXT]
    : [];

  return {
    enabled: true,
    programId: expectedProgramId,
    environmentId: expectedEnvironmentId,
    cwd: workspaceDir,
    commonFlags,
    timeoutMs: {
      short: parseInt(process.env.RDE_E2E_TIMEOUT_SHORT_MS, 10) || 60 * 1000,
      create:
        parseInt(process.env.RDE_E2E_TIMEOUT_CREATE_MS, 10) || 20 * 60 * 1000,
      restore:
        parseInt(process.env.RDE_E2E_TIMEOUT_RESTORE_MS, 10) || 25 * 60 * 1000,
    },
  };
}

module.exports = { getE2EConfig };

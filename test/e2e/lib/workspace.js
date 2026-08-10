'use strict';

const fs = require('fs');
const path = require('path');
const hjson = require('hjson');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const DEFAULT_WORKSPACE_DIR = path.join(REPO_ROOT, 'test', 'workspace');

/**
 * Resolves the directory whose local `.aio` file the E2E suite should read
 * (for the safety check in env.js) and spawn `bin/run` from (so
 * @adobe/aio-lib-core-config's cwd-based local-file resolution picks up the
 * same file inside the child process).
 *
 * Keeping E2E credentials in a dedicated `test/workspace/.aio` - rather than
 * a `.aio` at the repo root - avoids ever colliding with a developer's own
 * day-to-day plugin config in this repo. Resolution order:
 *   1. RDE_E2E_WORKSPACE_DIR, if set (resolved relative to the repo root)
 *   2. test/workspace/, if test/workspace/.aio already exists
 *   3. the repo root itself (backwards-compatible default)
 *
 * @returns {string} absolute path to the resolved workspace directory
 */
function resolveWorkspaceDir() {
  if (process.env.RDE_E2E_WORKSPACE_DIR) {
    return path.resolve(REPO_ROOT, process.env.RDE_E2E_WORKSPACE_DIR);
  }
  if (fs.existsSync(path.join(DEFAULT_WORKSPACE_DIR, '.aio'))) {
    return DEFAULT_WORKSPACE_DIR;
  }
  return REPO_ROOT;
}

/**
 * Reads and parses the `.aio` local config file in the given directory
 * directly off disk, without going through @adobe/aio-lib-core-config -
 * that library resolves its local file from `process.cwd()` at require
 * time, which would be the E2E test runner's own cwd, not the workspace
 * directory we actually want to inspect.
 *
 * @adobe/aio-lib-core-config persists `.aio` using hjson (unquoted keys),
 * not strict JSON, so a plain JSON.parse fails on any real config file.
 *
 * @param {string} workspaceDir
 * @returns {object} parsed contents, or {} if missing/unparsable
 */
function readLocalAioConfig(workspaceDir) {
  const file = path.join(workspaceDir, '.aio');
  if (!fs.existsSync(file)) {
    return {};
  }
  try {
    return hjson.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = { REPO_ROOT, resolveWorkspaceDir, readLocalAioConfig };

'use strict';

const { runCliJson } = require('./cli-runner');

/**
 * Thin wrappers around `aem:rde:snapshot:*` for the E2E specs.
 * Every function returns whatever `runCliJson` returns:
 * { stdout, stderr, exitCode, json }.
 *
 * Note: command IDs are passed as a single colon-joined argv token (e.g.
 * 'aem:rde:snapshot:create'), not as separate space-joined tokens. This
 * repo's own bin/run has no space topic-separator configured (that's set up
 * by the real `aio` CLI host), so `['aem', 'rde', 'snapshot', 'create']`
 * fails to resolve when invoked directly via bin/run.
 */

async function listSnapshots(commonFlags, opts) {
  return runCliJson(['aem:rde:snapshot', ...commonFlags], opts);
}

async function findSnapshot(commonFlags, name, opts) {
  const { json } = await listSnapshots(commonFlags, opts);
  const snapshots = json?.snapshots || [];
  return snapshots.find((s) => s.name === name);
}

async function createSnapshot(
  commonFlags,
  name,
  { description, ...opts } = {}
) {
  const args = ['aem:rde:snapshot:create', name, ...commonFlags];
  if (description) {
    args.push('--description', description);
  }
  return runCliJson(args, opts);
}

async function restoreSnapshot(
  commonFlags,
  name,
  { onlyMutableContent, ...opts } = {}
) {
  const args = ['aem:rde:snapshot:restore', name, ...commonFlags];
  if (onlyMutableContent) {
    args.push('--only-mutable-content');
  }
  return runCliJson(args, opts);
}

async function deleteSnapshot(commonFlags, name, { force, ...opts } = {}) {
  const args = ['aem:rde:snapshot:delete', name, ...commonFlags];
  if (force) {
    args.push('--force');
  }
  return runCliJson(args, opts);
}

async function undeleteSnapshot(commonFlags, name, opts) {
  return runCliJson(['aem:rde:snapshot:undelete', name, ...commonFlags], opts);
}

/**
 * Best-effort cleanup for a test-created snapshot: soft-delete then
 * force-delete (the backend only allows a hard wipe once a snapshot is
 * already in the deleted state). Swallows all errors - used from `after()`
 * hooks so a failed test doesn't leave cruft behind on a shared scratch RDE.
 */
async function cleanupSnapshot(commonFlags, name, opts = {}) {
  try {
    await deleteSnapshot(commonFlags, name, { timeoutMs: 60 * 1000, ...opts });
  } catch {
    // ignore - may already be deleted or never created
  }
  try {
    await deleteSnapshot(commonFlags, name, {
      force: true,
      timeoutMs: 60 * 1000,
      ...opts,
    });
  } catch {
    // ignore - may already be gone
  }
}

module.exports = {
  listSnapshots,
  findSnapshot,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  undeleteSnapshot,
  cleanupSnapshot,
};

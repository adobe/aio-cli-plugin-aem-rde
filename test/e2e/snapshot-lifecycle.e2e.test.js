'use strict';

const assert = require('assert');
const { getE2EConfig } = require('./lib/env');
const { runCliJson } = require('./lib/cli-runner');
const {
  findSnapshot,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  undeleteSnapshot,
  cleanupSnapshot,
} = require('./lib/snapshot-helpers');
const { bundleUrl, bundleSymbolicName } = require('./lib/fixtures');

const e2e = getE2EConfig();

// Merges the resolved E2E workspace cwd into per-call opts, so bin/run picks
// up the same local `.aio` config that env.js validated.
const opts = (extra) => ({ cwd: e2e.cwd, ...extra });

/**
 * Full snapshot lifecycle against a real RDE, combined with an osgi-bundle
 * install so a single pair of snapshots covers both:
 *
 *   snapshot "before" -> install bundle -> snapshot "after" ->
 *   restore "before" (bundle gone) -> restore "after" (bundle back) ->
 *   delete (soft) -> undelete -> delete (soft) -> delete --force (hard wipe)
 *
 * This used to be two separate specs (a plain create/restore/delete/undelete
 * lifecycle, and a second one bracketing an install between two snapshots),
 * which together needed 3 snapshot creates + 3 restores. Folding the CRUD
 * steps onto the same "after" snapshot used for the install-state check
 * gets the same coverage from 2 creates + 2 restores instead - each
 * create/restore realistically takes 5-20 minutes against a real backend,
 * so this roughly halves the suite's wall-clock time.
 *
 * WARNING: `restore` replaces the environment's content/deployment state,
 * and both create/restore lock the RDE for several minutes. Only ever run
 * this against a disposable/scratch RDE - see README.md "End-to-end (E2E)
 * testing" for the required one-time setup and safety gate.
 */
(e2e.enabled ? describe : describe.skip)(
  'E2E: aio aem rde snapshot lifecycle',
  function () {
    if (!e2e.enabled) {
      console.log(e2e.reason);
      return;
    }

    const runId = Date.now();
    const beforeName = `e2e-before-${runId}`;
    const afterName = `e2e-after-${runId}`;

    async function bundleIsInstalled() {
      const { json } = await runCliJson(
        ['aem:rde:status', ...e2e.commonFlags],
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      return json.author.osgiBundles.some(
        (bundle) => bundle.metadata.bundleSymbolicName === bundleSymbolicName
      );
    }

    after(async function () {
      this.timeout(e2e.timeoutMs.short);
      await cleanupSnapshot(e2e.commonFlags, beforeName, opts());
      await cleanupSnapshot(e2e.commonFlags, afterName, opts());
      // best-effort: restoring "after" leaves the bundle installed - clean
      // it up so the RDE ends up clean regardless of where a failure hit.
      try {
        await runCliJson(
          [
            'aem:rde:delete',
            bundleSymbolicName,
            '--target',
            'author',
            ...e2e.commonFlags,
          ],
          opts({ timeoutMs: e2e.timeoutMs.short })
        );
      } catch {
        // ignore - may already be gone
      }
    });

    it('creates a baseline snapshot before installing the bundle', async function () {
      this.timeout(e2e.timeoutMs.create);

      assert.strictEqual(
        await bundleIsInstalled(),
        false,
        'bundle unexpectedly already installed before this spec ran'
      );

      const { exitCode, stderr, json } = await createSnapshot(
        e2e.commonFlags,
        beforeName,
        opts({
          description:
            'Baseline before install, by aio-cli-plugin-aem-rde E2E tests',
          timeoutMs: e2e.timeoutMs.create,
        })
      );
      assert.strictEqual(
        exitCode,
        0,
        `baseline snapshot create failed:\n${stderr}`
      );
      assert.ok(json.startTime, 'expected a startTime in the JSON result');
      assert.ok(json.endTime, 'expected an endTime in the JSON result');

      const listed = await findSnapshot(
        e2e.commonFlags,
        beforeName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.ok(listed, `snapshot ${beforeName} not found after create`);
      assert.strictEqual(listed.state, 'available');
    });

    it('installs the osgi-bundle', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr } = await runCliJson(
        [
          'aem:rde:install',
          bundleUrl,
          '--type',
          'osgi-bundle',
          '--target',
          'author',
          ...e2e.commonFlags,
        ],
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.strictEqual(exitCode, 0, `install failed:\n${stderr}`);
      assert.strictEqual(
        await bundleIsInstalled(),
        true,
        'bundle missing right after install'
      );
    });

    it('creates a second snapshot after installing the bundle', async function () {
      this.timeout(e2e.timeoutMs.create);

      const { exitCode, stderr } = await createSnapshot(
        e2e.commonFlags,
        afterName,
        opts({
          description: 'After install, by aio-cli-plugin-aem-rde E2E tests',
          timeoutMs: e2e.timeoutMs.create,
        })
      );
      assert.strictEqual(
        exitCode,
        0,
        `post-install snapshot create failed:\n${stderr}`
      );
    });

    it('restoring the baseline snapshot removes the bundle', async function () {
      this.timeout(e2e.timeoutMs.restore);

      const { exitCode, stderr } = await restoreSnapshot(
        e2e.commonFlags,
        beforeName,
        opts({ timeoutMs: e2e.timeoutMs.restore })
      );
      assert.strictEqual(
        exitCode,
        0,
        `baseline snapshot restore failed:\n${stderr}`
      );
      assert.strictEqual(
        await bundleIsInstalled(),
        false,
        'bundle still present after restoring the baseline snapshot'
      );
    });

    it('restoring the post-install snapshot brings the bundle back', async function () {
      this.timeout(e2e.timeoutMs.restore);

      const { exitCode, stderr } = await restoreSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.restore })
      );
      assert.strictEqual(
        exitCode,
        0,
        `post-install snapshot restore failed:\n${stderr}`
      );
      assert.strictEqual(
        await bundleIsInstalled(),
        true,
        'bundle missing after restoring the post-install snapshot'
      );
    });

    it('soft-deletes the post-install snapshot', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr } = await deleteSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.strictEqual(exitCode, 0, `snapshot delete failed:\n${stderr}`);

      const listed = await findSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.ok(listed, `snapshot ${afterName} not found after soft-delete`);
      assert.strictEqual(listed.state, 'deleted');
    });

    it('undeletes the post-install snapshot', async function () {
      this.timeout(e2e.timeoutMs.short);

      const { exitCode, stderr } = await undeleteSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.strictEqual(exitCode, 0, `snapshot undelete failed:\n${stderr}`);

      const listed = await findSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.ok(listed, `snapshot ${afterName} not found after undelete`);
      assert.strictEqual(listed.state, 'available');
    });

    it('force-deletes the post-install snapshot after a soft-delete', async function () {
      this.timeout(e2e.timeoutMs.short);

      const softDelete = await deleteSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.strictEqual(
        softDelete.exitCode,
        0,
        `snapshot delete (soft) failed:\n${softDelete.stderr}`
      );

      const forceDelete = await deleteSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ force: true, timeoutMs: e2e.timeoutMs.short })
      );
      assert.strictEqual(
        forceDelete.exitCode,
        0,
        `snapshot delete --force failed:\n${forceDelete.stderr}`
      );

      const listed = await findSnapshot(
        e2e.commonFlags,
        afterName,
        opts({ timeoutMs: e2e.timeoutMs.short })
      );
      assert.ok(
        !listed,
        `snapshot ${afterName} still present after force-delete`
      );
    });
  }
);

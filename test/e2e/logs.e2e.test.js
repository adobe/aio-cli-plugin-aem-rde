'use strict';

const assert = require('assert');
const { runCli, spawnCli } = require('./lib/cli-runner');
const { getE2EConfig } = require('./lib/env');

const e2e = getE2EConfig();

const NO_ACTIVE_LOG = 'No active log configuration found.';

/**
 * `aem:rde:logs` disables --json (`enableJsonFlag: false`) and, once a log
 * configuration is created, polls indefinitely until interrupted - it's
 * built for an interactive terminal, not a one-shot scripted call. So unlike
 * the other specs, this uses `spawnCli` to interact with the still-running
 * process (send SIGINT, like a real Ctrl+C) rather than `runCli`/`runCliJson`
 * waiting for it to exit on its own.
 *
 * `--choose` is used as a non-interactive probe: when there are zero active
 * log configurations it returns immediately with a fixed message instead of
 * opening the interactive picker (see chooseLogConfiguration in logs.js).
 */
(e2e.enabled ? describe : describe.skip)('E2E: aio aem rde logs', function () {
  if (!e2e.enabled) {
    console.log(e2e.reason);
    return;
  }

  async function assertNoActiveLogConfiguration() {
    const { exitCode, stdout, stderr } = await runCli(
      ['aem:rde:logs', '--choose', '--target', 'author', ...e2e.commonFlags],
      { timeoutMs: e2e.timeoutMs.short, cwd: e2e.cwd }
    );
    assert.strictEqual(exitCode, 0, `logs --choose failed:\n${stderr}`);
    assert.ok(
      stdout.includes(NO_ACTIVE_LOG),
      `expected "${NO_ACTIVE_LOG}", got:\n${stdout}`
    );
  }

  it('reports no active log configuration beforehand', async function () {
    this.timeout(e2e.timeoutMs.short);
    await assertNoActiveLogConfiguration();
  });

  it('creates a log tail and cleans it up on Ctrl+C', async function () {
    // the SIGINT listener in logs.js is only registered after the
    // create-log network call resolves, so this test's own wait below has
    // to comfortably outlast that call - give the overall test extra room
    // beyond the usual "short" budget to cover it plus the exit race below.
    this.timeout(e2e.timeoutMs.short + 30000);

    const child = spawnCli(
      ['aem:rde:logs', '-i', '', '--target', 'author', ...e2e.commonFlags],
      { cwd: e2e.cwd }
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));

    const exited = new Promise((resolve) => {
      child.on('exit', (code, signal) => resolve({ code, signal }));
    });

    // Give the command enough time to create the log configuration and
    // register its SIGINT handler before we interrupt it, like a real
    // Ctrl+C would. A short, fixed wait here previously raced the
    // create-log call on a loaded backend: if SIGINT arrived before the
    // handler was registered, the process died ungracefully (Node's default
    // SIGINT behavior) and the just-created log configuration was left
    // dangling server-side, breaking later runs of this suite.
    await new Promise((resolve) => setTimeout(resolve, 10000));
    child.kill('SIGINT');

    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('logs process did not exit after SIGINT')),
        15000
      )
    );
    const { code, signal } = await Promise.race([exited, timeout]).catch(
      (err) => {
        child.kill('SIGKILL');
        throw new Error(`${err.message}\nstderr:\n${stderr}`);
      }
    );

    assert.ok(
      code === 0 && !signal,
      `expected a graceful shutdown (code 0, no signal), got code=${code} signal=${signal}\n${stderr}`
    );

    // the SIGINT handler deletes the log configuration before exiting -
    // confirm it's actually gone rather than trusting the exit code alone.
    await assertNoActiveLogConfiguration();
  });
});

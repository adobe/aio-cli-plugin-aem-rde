'use strict';

const { execFile, spawn } = require('child_process');
const { REPO_ROOT, resolveWorkspaceDir } = require('./workspace');
const path = require('path');

const BIN_RUN = path.join(REPO_ROOT, 'bin', 'run');
const DEFAULT_TIMEOUT_MS = 60 * 1000;
const MAX_BUFFER = 32 * 1024 * 1024;
// Every e2e spec passes the same value to both mocha's own this.timeout()
// and here as opts.timeoutMs. Shaving a small buffer off the exec-level
// timeout means a genuine stall reliably hits *this* timeout first - giving
// a real rejected error (with stdout/stderr attached) - instead of racing
// mocha's own blunt "Timeout of Nms exceeded" with no diagnostics.
const TIMEOUT_SAFETY_BUFFER_MS = 5000;

/**
 * Runs the plugin's own bin/run (i.e. `node ./bin/run <args>`), which reads
 * commands/hooks straight from this repo's package.json - no need for the
 * real `aio` CLI to be installed or for the plugin to be linked into it.
 *
 * Spawned with `cwd` set to the resolved E2E workspace directory (see
 * workspace.js) so @adobe/aio-lib-core-config's local `.aio` file resolution
 * (which is based on the running process's cwd) picks up the same
 * `test/workspace/.aio` (or override) that env.js validates against.
 *
 * Never throws on a non-zero exit code; callers assert on `exitCode` since
 * the README documents specific exit codes for specific failure classes.
 *
 * @param {string[]} args CLI arguments, e.g. ['aem:rde:status']
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.cwd] overrides the resolved workspace directory
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function runCli(args, opts = {}) {
  const timeout = Math.max(
    1000,
    (opts.timeoutMs || DEFAULT_TIMEOUT_MS) - TIMEOUT_SAFETY_BUFFER_MS
  );
  const cwd = opts.cwd || resolveWorkspaceDir();
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [BIN_RUN, ...args],
      {
        timeout,
        maxBuffer: MAX_BUFFER,
        cwd,
        // Force colors off regardless of the invoking shell's env (e.g. a
        // FORCE_COLOR set by the parent terminal) - ANSI codes in --json
        // output would otherwise break JSON.parse in extractTrailingJson.
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      },
      (err, stdout, stderr) => {
        if (err && typeof err.code !== 'number') {
          // process failed to spawn, was killed, or timed out - not a
          // regular CLI exit-code failure we want tests to assert on.
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
          return;
        }
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: err ? err.code : 0,
        });
      }
    );
  });
}

/**
 * With --json, oclif's own log()/logToStderr() no-op entirely (see
 * @oclif/core's Command#log), and it only prints a JSON blob to stdout when
 * the command's runCommand() returns a truthy value (see Command#_run:
 * `if (result && this.jsonEnabled())`). Some commands (e.g. snapshot
 * delete/undelete) return nothing, so stdout is legitimately empty on
 * success - that's not an error. This scans stdout backwards for the last
 * position where a JSON value starts and successfully parses through to the
 * end of the string, which tolerates that empty case as well as any
 * unexpected extra output ahead of the JSON blob.
 *
 * @param {string} stdout
 * @returns {*} the parsed JSON value, or undefined if stdout has no JSON
 */
function extractTrailingJson(stdout) {
  if (!stdout || !stdout.trim()) {
    return undefined;
  }
  for (let i = stdout.length - 1; i >= 0; i--) {
    const ch = stdout[i];
    if (ch !== '{' && ch !== '[') continue;
    const candidate = stdout.slice(i);
    try {
      return JSON.parse(candidate);
    } catch {
      // not a valid JSON start at this position, keep scanning backwards
    }
  }
  throw new Error(
    `Expected trailing JSON value in non-empty CLI stdout but found none:\n${stdout}`
  );
}

/**
 * Same as runCli, but appends --json and parses the trailing JSON result.
 * `json` is undefined when the command produced no JSON result (e.g. a
 * successful `snapshot delete`/`undelete`, which return nothing) or when
 * the command exited non-zero.
 *
 * @param {string[]} args
 * @param {object} [opts]
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, json: (*|undefined)}>}
 */
async function runCliJson(args, opts = {}) {
  const result = await runCli([...args, '--json'], opts);
  let json;
  if (result.exitCode === 0) {
    json = extractTrailingJson(result.stdout);
  }
  return { ...result, json };
}

/**
 * Spawns bin/run and returns the raw, still-running child process, instead
 * of waiting for it to exit like runCli/runCliJson do. For commands that
 * don't terminate on their own (e.g. `aem:rde:logs`, which polls until
 * SIGINT/SIGTERM) and where a test needs to interact with the process while
 * it's running rather than after the fact.
 *
 * Same cwd resolution and forced-colors-off env as runCli.
 *
 * @param {string[]} args CLI arguments, e.g. ['aem:rde:logs']
 * @param {object} [opts]
 * @param {string} [opts.cwd] overrides the resolved workspace directory
 * @returns {import('child_process').ChildProcess}
 */
function spawnCli(args, opts = {}) {
  const cwd = opts.cwd || resolveWorkspaceDir();
  return spawn(process.execPath, [BIN_RUN, ...args], {
    cwd,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
}

module.exports = {
  runCli,
  runCliJson,
  extractTrailingJson,
  spawnCli,
  REPO_ROOT,
};

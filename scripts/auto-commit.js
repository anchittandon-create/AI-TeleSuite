#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const process = require('node:process');

const dryRun = process.env.DRY_RUN === '1';

function formatArgs(args) {
  return args.map(arg => (arg.includes(' ') ? `'${arg.replace(/'/g, "'\\''")}'` : arg)).join(' ');
}

function runGit(args, { allowFail = false, capture = false } = {}) {
  if (dryRun) {
    console.log(`[DRY RUN] git ${formatArgs(args)}`);
    return { status: 0, stdout: '', stderr: '' };
  }

  const stdio = capture ? ['inherit', 'pipe', 'pipe'] : 'inherit';
  const result = spawnSync('git', args, {
    stdio,
    encoding: capture ? 'utf-8' : undefined,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFail) {
    const stderrOutput = capture ? result.stderr : undefined;
    const message = stderrOutput ? stderrOutput : `git ${formatArgs(args)} failed with exit code ${result.status}`;
    throw new Error(message);
  }

  return result;
}

const statusResult = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
if (statusResult.error) {
  throw statusResult.error;
}

const pendingChanges = statusResult.stdout?.trim();
if (!pendingChanges) {
  console.log('Auto-commit skipped: no changes detected.');
  process.exit(0);
}

const commitMessage = `auto-commit: ${new Date().toISOString()}`;

try {
  runGit(['add', '--all']);

  const commitResult = runGit(['commit', '-m', commitMessage], { allowFail: true, capture: true });

  if (!dryRun && commitResult.status !== 0) {
    const stderrText = commitResult.stderr ?? '';
    const stdoutText = commitResult.stdout ?? '';
    const combinedOutput = `${stdoutText}\n${stderrText}`;
    if (combinedOutput.includes('nothing to commit')) {
      console.log('Auto-commit skipped: nothing to commit after staging.');
      process.exit(0);
    }
    throw new Error(combinedOutput || 'git commit failed.');
  }

  runGit(['push', 'origin', 'HEAD']);

  console.log('Auto-commit: changes pushed successfully.');
} catch (error) {
  console.error('Auto-commit failed:', error.message ?? error);
  process.exitCode = 1;
}

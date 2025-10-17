#!/usr/bin/env node

import { lstat, readdir, rm, rmdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const targets = [
  { path: '.next', description: 'Next.js build artifacts' },
  { path: '.turbo', description: 'Turbopack cache' },
  { path: 'out', description: 'Static export output' },
];

async function removeIfExists(target) {
  const absolutePath = resolve(process.cwd(), target.path);

  try {
    await stat(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  await removeWithFallback(absolutePath);
  console.log(`[clean-next] Removed ${target.path} (${target.description}).`);
  return true;
}

async function main() {
  let removedSomething = false;

  for (const target of targets) {
    // Remove build caches so each build starts from a consistent state.
    removedSomething = (await removeIfExists(target)) || removedSomething;
  }

  if (!removedSomething) {
    console.log('[clean-next] Nothing to remove.');
  }
}

main().catch((error) => {
  console.error('[clean-next] Failed to clean build artifacts.');
  console.error(error);
  process.exitCode = 1;
});

async function removeWithFallback(path) {
  try {
    await rm(path, { recursive: true, force: true });
    return;
  } catch (error) {
    if (error.code !== 'ENOTEMPTY') {
      throw error;
    }
  }

  await rimraf(path);
}

async function rimraf(path) {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    try {
      await unlink(path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    return;
  }

  const entries = await readdir(path);
  for (const entry of entries) {
    await rimraf(join(path, entry));
  }

  try {
    await rmdir(path);
  } catch (error) {
    if (error.code === 'ENOTEMPTY') {
      // A race condition may have added new entries; recurse again.
      await rimraf(path);
    } else if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

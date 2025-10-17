#!/usr/bin/env node

/**
 * Starts Next.js on the first available port.
 * Priority:
 *   1. Respect PORT if it's free.
 *   2. Try common development ports (3000, 3001, 3002, 9003, ...).
 *   3. Fall back to a random OS-assigned port.
 */

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
process.chdir(PROJECT_ROOT);

const COMMON_PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 9003];
const MAX_INCREMENT = 20;

function probePort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer().unref();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(null);
      } else {
        reject(err);
      }
    });
    server.listen(port, '0.0.0.0', () => {
      const address = server.address();
      const selectedPort = typeof address === 'object' ? address.port : port;
      server.close(() => resolve(selectedPort));
    });
  });
}

async function findAvailablePort() {
  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0) {
    const openPort = await probePort(envPort);
    if (openPort) {
      return openPort;
    }
    console.warn(`[start-next] Port ${envPort} is in use. Searching for another port...`);
  }

  for (const candidate of COMMON_PORTS) {
    const openPort = await probePort(candidate);
    if (openPort === candidate) {
      return candidate;
    }
  }

  const base = 4000;
  for (let offset = 0; offset < MAX_INCREMENT; offset++) {
    const candidate = base + offset;
    const openPort = await probePort(candidate);
    if (openPort === candidate) {
      return candidate;
    }
  }

  const randomPort = await probePort(0);
  if (randomPort) {
    return randomPort;
  }

  throw new Error('Unable to find a free port for Next.js to bind to.');
}

async function start() {
  try {
    const port = await findAvailablePort();
    process.env.PORT = String(port);
    console.log(`[start-next] Starting Next.js on port ${port}`);

    const nextBin = require.resolve('next/dist/bin/next');
    const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } catch (err) {
    console.error('[start-next] Failed to launch Next.js:', err);
    process.exit(1);
  }
}

start();

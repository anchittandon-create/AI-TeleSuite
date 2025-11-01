#!/usr/bin/env node

const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Auto-deployment script that handles git operations and Vercel deployment
class AutoDeployer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.isWatching = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  runCommand(command, args, options = {}) {
    try {
      const result = spawnSync(command, args, {
        cwd: this.projectRoot,
        stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
        encoding: options.capture ? 'utf-8' : undefined,
        ...options
      });

      if (result.error) {
        throw result.error;
      }

      return result;
    } catch (error) {
      this.log(`Command failed: ${command} ${args.join(' ')} - ${error.message}`, 'error');
      throw error;
    }
  }

  hasChanges() {
    try {
      const result = this.runCommand('git', ['status', '--porcelain'], { capture: true });
      return result.stdout && result.stdout.trim().length > 0;
    } catch (error) {
      this.log('Failed to check git status', 'error');
      return false;
    }
  }

  getCurrentBranch() {
    try {
      const result = this.runCommand('git', ['branch', '--show-current'], { capture: true });
      return result.stdout ? result.stdout.trim() : 'main';
    } catch (error) {
      this.log('Failed to get current branch, defaulting to main', 'error');
      return 'main';
    }
  }

  async deployChanges(commitMessage = null) {
    if (!this.hasChanges()) {
      this.log('No changes detected, skipping deployment');
      return false;
    }

    const defaultMessage = `auto-deploy: ${new Date().toISOString()}`;
    const message = commitMessage || defaultMessage;

    try {
      // Stage all changes
      this.log('Staging all changes...');
      this.runCommand('git', ['add', '-A']);

      // Commit changes
      this.log(`Committing with message: ${message}`);
      this.runCommand('git', ['commit', '-m', message]);

      // Push to remote
      const branch = this.getCurrentBranch();
      this.log(`Pushing to origin/${branch}...`);
      this.runCommand('git', ['push', 'origin', branch]);

      // Trigger Vercel deployment
      this.log('Triggering Vercel deployment...');
      try {
        this.runCommand('vercel', ['--prod']);
        this.log('Vercel deployment triggered successfully!', 'success');
      } catch (vercelError) {
        this.log('Vercel deployment may have failed, but changes were pushed', 'error');
      }

      return true;
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      return false;
    }
  }

  startWatching() {
    if (this.isWatching) {
      this.log('File watcher is already running');
      return;
    }

    this.log('Starting file watcher for auto-deployment...');
    
    // Watch for file changes using chokidar
    const chokidar = spawn('npx', ['chokidar', '**/*', 
      '--initial=false',
      '--ignore', '**/.git/**',
      '--ignore', '**/node_modules/**', 
      '--ignore', '**/.next/**',
      '--ignore', '**/.vercel/**',
      '--ignore', '**/.husky/_/**',
      '--throttle', '5000'
    ], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    this.isWatching = true;

    chokidar.on('close', (code) => {
      this.log(`File watcher stopped with code ${code}`);
      this.isWatching = false;
    });

    // Handle file changes
    let deployTimeout;
    chokidar.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('change') || output.includes('add') || output.includes('unlink')) {
        clearTimeout(deployTimeout);
        deployTimeout = setTimeout(() => {
          this.log('File changes detected, deploying...');
          this.deployChanges('auto-deploy: file changes detected');
        }, 3000); // 3 second debounce
      }
    });

    return chokidar;
  }

  stopWatching() {
    this.isWatching = false;
    this.log('File watcher stopped');
  }
}

// CLI interface
const deployer = new AutoDeployer();

const command = process.argv[2];
const message = process.argv[3];

switch (command) {
  case 'watch':
    deployer.startWatching();
    break;
  case 'deploy':
    deployer.deployChanges(message);
    break;
  case 'check':
    console.log('Has changes:', deployer.hasChanges());
    break;
  default:
    console.log(`
Usage:
  node auto-deploy.js watch          # Start watching for file changes
  node auto-deploy.js deploy [msg]   # Deploy current changes
  node auto-deploy.js check          # Check if there are pending changes

Examples:
  node auto-deploy.js deploy "Fix API endpoint bug"
  node auto-deploy.js watch
`);
}

module.exports = AutoDeployer;
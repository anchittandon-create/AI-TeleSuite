#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Simple script to show deployment status and auto-deploy changes
function runCommand(cmd, args) {
  try {
    const result = spawnSync(cmd, args, { 
      encoding: 'utf-8',
      cwd: path.resolve(__dirname, '..')
    });
    return { success: result.status === 0, output: result.stdout, error: result.stderr };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

function checkGitStatus() {
  const status = runCommand('git', ['status', '--porcelain']);
  const branch = runCommand('git', ['branch', '--show-current']);
  const lastCommit = runCommand('git', ['log', '-1', '--oneline']);
  
  return {
    hasChanges: status.success && status.output.trim().length > 0,
    changes: status.output,
    currentBranch: branch.success ? branch.output.trim() : 'unknown',
    lastCommit: lastCommit.success ? lastCommit.output.trim() : 'No commits'
  };
}

function checkVercelStatus() {
  const whoami = runCommand('vercel', ['whoami']);
  return {
    loggedIn: whoami.success,
    user: whoami.success ? whoami.output.trim() : 'Not logged in'
  };
}

// Main execution
console.log('🚀 AI-TeleSuite Auto-Deployment Status\n');

const gitStatus = checkGitStatus();
const vercelStatus = checkVercelStatus();

console.log('📊 Git Status:');
console.log(`   Branch: ${gitStatus.currentBranch}`);
console.log(`   Last Commit: ${gitStatus.lastCommit}`);
console.log(`   Pending Changes: ${gitStatus.hasChanges ? '✅ Yes' : '❌ No'}`);

if (gitStatus.hasChanges) {
  console.log('\n📝 Changed Files:');
  gitStatus.changes.split('\n').forEach(line => {
    if (line.trim()) {
      console.log(`   ${line}`);
    }
  });
}

console.log('\n🔗 Vercel Status:');
console.log(`   Logged In: ${vercelStatus.loggedIn ? '✅ Yes' : '❌ No'}`);
if (vercelStatus.loggedIn) {
  console.log(`   User: ${vercelStatus.user}`);
}

console.log('\n🛠️ Available Commands:');
console.log('   npm run deploy              # Deploy current changes');
console.log('   npm run deploy:watch        # Start watching for changes');
console.log('   npm run auto-deploy:check   # Check deployment status');

// Auto-deploy if there are changes and user wants it
if (process.argv.includes('--auto') && gitStatus.hasChanges) {
  console.log('\n🚀 Auto-deploying changes...');
  const deploy = runCommand('npm', ['run', 'deploy']);
  if (deploy.success) {
    console.log('✅ Auto-deployment completed successfully!');
  } else {
    console.log('❌ Auto-deployment failed:', deploy.error);
  }
}

console.log('\n💡 Tip: Run with --auto flag to automatically deploy pending changes');
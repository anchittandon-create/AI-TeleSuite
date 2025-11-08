# Git History Cleanup Guide

## ⚠️ CRITICAL: This Must Be Done IMMEDIATELY

The sensitive files (`.env.local` and `key.json`) have been removed from git tracking, but they **still exist in the git history**. Anyone who has already cloned the repository can still access these files from old commits.

## Current Status

✅ **Completed**:
- Files removed from git tracking (not tracked in future commits)
- Committed and pushed to GitHub
- Security incident documented

⚠️ **Urgent Actions Needed**:
- Clean git history to remove all traces of secret files
- Rotate ALL exposed credentials immediately
- Force push to overwrite remote history

---

## Step 1: Install BFG Repo Cleaner (Recommended Method)

BFG is faster and safer than `git filter-branch` for removing sensitive data.

### On macOS:
```bash
brew install bfg
```

### On Linux:
```bash
# Download the latest JAR file
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
# Create alias
alias bfg='java -jar ~/bfg-1.14.0.jar'
```

### On Windows:
```powershell
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# Run with: java -jar bfg-1.14.0.jar
```

---

## Step 2: Backup Your Repository (IMPORTANT!)

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite
cd ..
cp -r AI-TeleSuite AI-TeleSuite-backup-$(date +%Y%m%d-%H%M%S)
cd AI-TeleSuite
```

---

## Step 3: Clean Git History with BFG

### Method A: Delete specific files from history

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Remove .env.local from all commits
bfg --delete-files .env.local

# Remove key.json from all commits
bfg --delete-files key.json

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Method B: Delete files matching a pattern

```bash
# Remove all .env files (be careful with this!)
bfg --delete-files '*.env.local'
bfg --delete-files 'key.json'

git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Method C: Using git filter-repo (Alternative)

If BFG doesn't work, use `git-filter-repo`:

```bash
# Install git-filter-repo
pip3 install git-filter-repo

# Remove specific files
git filter-repo --path .env.local --invert-paths
git filter-repo --path key.json --invert-paths
```

---

## Step 4: Force Push to Remote

⚠️ **WARNING**: This will rewrite history on GitHub. Coordinate with team members first!

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Force push to overwrite remote history
git push origin main --force

# If you have other branches, force push them too
git push origin --force --all

# Force push tags (if any)
git push origin --force --tags
```

---

## Step 5: Verify History is Clean

```bash
# Check if files still appear in git history
git log --all --full-history -- .env.local
git log --all --full-history -- key.json

# The above commands should return NO results

# Verify files are not in any commit
git rev-list --all | xargs git grep 'AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ'
git rev-list --all | xargs git grep 'vercel_blob_rw_bkO0d1ptF0jWiSJU'

# These searches should return NO results
```

---

## Step 6: Rotate All Credentials (DO THIS NOW!)

### 1. Google API Key (URGENT - Do First!)

```bash
# Go to Google Cloud Console
open https://console.cloud.google.com/apis/credentials

# Steps:
# 1. Find key: AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ
# 2. Click the trash icon to DELETE it
# 3. Click "Create Credentials" → "API Key"
# 4. Copy the NEW key
# 5. Add restrictions (HTTP referrer, API restrictions)
```

Update locally:
```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Create new .env.local with NEW credentials
cat > .env.local << 'EOF'
GOOGLE_API_KEY=YOUR_NEW_KEY_HERE
NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_NEW_KEY_HERE
GEMINI_API_KEY=YOUR_NEW_KEY_HERE
BLOB_READ_WRITE_TOKEN=YOUR_NEW_BLOB_TOKEN_HERE
GOOGLE_TTS_SA_JSON='YOUR_NEW_SERVICE_ACCOUNT_JSON_HERE'

# Optional rate limiting
MAX_EXPENSIVE_CALLS_PER_HOUR=5
MAX_MODERATE_CALLS_PER_HOUR=20
MAX_LIGHT_CALLS_PER_HOUR=100
EOF

# IMPORTANT: Replace the placeholder values above with your actual new keys!
```

### 2. Vercel Blob Token

```bash
# Go to Vercel Dashboard
open https://vercel.com/dashboard/stores

# Steps:
# 1. Find your Blob storage
# 2. Click "Regenerate Token"
# 3. Copy the new token
# 4. Update .env.local with new token
```

### 3. Google Cloud Service Account

```bash
# Go to Service Accounts page
open https://console.cloud.google.com/iam-admin/serviceaccounts

# Steps:
# 1. Find the exposed service account
# 2. Click "Delete" or "Disable"
# 3. Create new service account:
#    - Name: "ai-telesuite-tts"
#    - Role: "Cloud Text-to-Speech API User"
# 4. Create and download new key.json
# 5. Update GOOGLE_TTS_SA_JSON in .env.local
```

### 4. Update Vercel Environment Variables

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Remove old keys
vercel env rm GOOGLE_API_KEY production
vercel env rm BLOB_READ_WRITE_TOKEN production
vercel env rm GOOGLE_TTS_SA_JSON production

# Add new keys
vercel env add GOOGLE_API_KEY production
# Paste your NEW Google API key when prompted

vercel env add BLOB_READ_WRITE_TOKEN production
# Paste your NEW Vercel Blob token when prompted

vercel env add GOOGLE_TTS_SA_JSON production
# Paste the entire JSON content from your NEW key.json when prompted
```

---

## Step 7: Notify Collaborators

If anyone else has cloned this repository, they need to:

1. **Delete their local clone**
2. **Re-clone from GitHub** (after you've force-pushed)
3. **Get new credentials** from you

Send this message:
```
⚠️ URGENT: Security Incident - Repository History Rewritten

The AI-TeleSuite repository had sensitive credentials committed to git history.

ACTION REQUIRED:
1. Delete your local clone: rm -rf AI-TeleSuite
2. Re-clone fresh: git clone https://github.com/anchittandon-create/AI-TeleSuite.git
3. Get new .env.local file from [your contact method]

DO NOT pull or merge - you must delete and re-clone!

All old API keys have been rotated and are no longer valid.
```

---

## Step 8: Verify Credentials Work

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Test Google API key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_NEW_KEY"

# Should return a list of models (not an error)

# Test locally
npm run dev

# Try the voice agent or transcription features
# Verify TTS and AI responses work
```

---

## Step 9: Set Up Pre-commit Hooks (Prevent Future Issues)

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Check for secret files
if git diff --cached --name-only | grep -E '\.env|key\.json|\.pem|\.key'; then
  echo "❌ ERROR: Attempting to commit secret files!"
  echo "Files blocked: .env.local, key.json, *.pem, *.key"
  exit 1
fi

# Check for API keys in content
if git diff --cached | grep -E 'AIza[0-9A-Za-z_-]{35}|sk-[0-9A-Za-z]{48}|vercel_blob_rw_[a-zA-Z0-9_-]+'; then
  echo "❌ ERROR: API key detected in commit!"
  echo "Remove the API key before committing."
  exit 1
fi

exit 0
EOF

# Make it executable
chmod +x .git/hooks/pre-commit

# Test the hook
echo "GOOGLE_API_KEY=AIzaSyTest123" > test-secret.txt
git add test-secret.txt
git commit -m "test"
# Should FAIL and block the commit

# Clean up test
rm test-secret.txt
git reset HEAD test-secret.txt
```

---

## Step 10: Monitor for Suspicious Activity

### Check Google Cloud Usage

```bash
# Go to Google Cloud Console
open https://console.cloud.google.com/billing

# Check for:
# - Unusual API calls
# - Spikes in usage
# - Calls from unexpected locations
```

### Check Vercel Usage

```bash
# Go to Vercel Dashboard
open https://vercel.com/dashboard/usage

# Check for:
# - Unusual Blob storage access
# - Unexpected bandwidth usage
```

### Set Up Alerts

1. **Google Cloud**:
   - Go to Billing → Budgets & Alerts
   - Set budget alert at $10, $50, $100

2. **Vercel**:
   - Go to Settings → Usage Alerts
   - Enable email notifications

---

## Verification Checklist

After completing all steps, verify:

- [ ] BFG or git-filter-repo completed successfully
- [ ] Force pushed to GitHub (all branches)
- [ ] `.env.local` not in git history (`git log --all --full-history -- .env.local` returns nothing)
- [ ] `key.json` not in git history (`git log --all --full-history -- key.json` returns nothing)
- [ ] Old Google API key is DELETED from Google Cloud Console
- [ ] New Google API key is working
- [ ] Old Vercel Blob token is regenerated
- [ ] New Vercel Blob token is working
- [ ] Old service account is disabled/deleted
- [ ] New service account and key.json created
- [ ] Vercel environment variables updated with new credentials
- [ ] Application works with new credentials (test TTS, transcription)
- [ ] Pre-commit hook is installed and tested
- [ ] Collaborators notified (if any)
- [ ] Billing alerts set up
- [ ] No suspicious activity in Google Cloud or Vercel usage

---

## Timeline

**Completed** (just now):
- ✅ Removed files from git tracking
- ✅ Committed removal
- ✅ Pushed to GitHub

**Do in next 30 minutes**:
1. Run BFG to clean history
2. Force push to GitHub
3. Rotate Google API key
4. Rotate Vercel Blob token
5. Rotate service account

**Do in next 1-2 hours**:
6. Update Vercel environment variables
7. Test application with new credentials
8. Set up pre-commit hooks
9. Set up billing alerts

**Do within 24 hours**:
10. Monitor for suspicious activity
11. Review all access logs

---

## If You Need Help

Common issues:

### "BFG didn't remove the file"
```bash
# Try git filter-repo instead
pip3 install git-filter-repo
git filter-repo --path .env.local --invert-paths
git filter-repo --path key.json --invert-paths
```

### "Force push rejected"
```bash
# If you have branch protection, disable it temporarily
# Then force push:
git push origin main --force --no-verify
```

### "Application not working with new keys"
```bash
# Check if environment variables are set
vercel env ls

# Pull environment variables locally
vercel env pull .env.local

# Restart development server
npm run dev
```

---

## Security Best Practices Going Forward

1. **Never commit secrets**
   - Use `.env.local` for local development
   - Use Vercel environment variables for production
   - Use `.env.example` as a template (with fake values)

2. **Use secret scanning tools**
   ```bash
   npm install -g @gitguardian/ggshield
   ggshield install --mode local
   ```

3. **Enable GitHub secret scanning**
   - Go to repository Settings → Code security and analysis
   - Enable "Secret scanning"

4. **Rotate credentials regularly**
   - Every 90 days at minimum
   - Immediately after any security incident

5. **Least privilege principle**
   - API keys should have minimum required permissions
   - Use API restrictions (HTTP referrer, IP restrictions)
   - Use separate keys for dev/staging/production

---

**Created**: November 8, 2025  
**Status**: URGENT - Complete all steps immediately

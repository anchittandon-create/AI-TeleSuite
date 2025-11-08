# 🔴 CRITICAL SECURITY INCIDENT - API Keys Exposed

**Date**: November 8, 2025  
**Severity**: CRITICAL  
**Status**: IMMEDIATE ACTION REQUIRED

## Exposed Credentials

The following secret files were committed to git and pushed to GitHub:

### 1. `.env.local` - API Keys Exposed
```
GOOGLE_API_KEY=AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ
GEMINI_API_KEY=AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_bkO0d1ptF0jWiSJU_A83S5Vu3tFMMUOicnQdpUujnhA07Is
```

### 2. `key.json` - Google Cloud Service Account
- Contains private keys for Google Cloud services
- Provides full access to Google Cloud resources

## Immediate Actions Required

### ⚠️ STEP 1: Rotate Google API Key (URGENT - Do this NOW!)

1. **Revoke the exposed key**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find key: `AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ`
   - Click "Delete" or "Revoke"

2. **Create new API key**:
   ```bash
   # Go to Google Cloud Console → APIs & Services → Credentials
   # Click "Create Credentials" → "API Key"
   # Copy the new key
   ```

3. **Update local environment**:
   ```bash
   # Create new .env.local with NEW key
   echo "GOOGLE_API_KEY=YOUR_NEW_KEY_HERE" > .env.local
   echo "NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_NEW_KEY_HERE" >> .env.local
   echo "GEMINI_API_KEY=YOUR_NEW_KEY_HERE" >> .env.local
   echo "BLOB_READ_WRITE_TOKEN=vercel_blob_rw_bkO0d1ptF0jWiSJU_A83S5Vu3tFMMUOicnQdpUujnhA07Is" >> .env.local
   
   # Add rate limiting and cost tracking environment variables
   echo "MAX_EXPENSIVE_CALLS_PER_HOUR=5" >> .env.local
   echo "MAX_MODERATE_CALLS_PER_HOUR=20" >> .env.local
   echo "MAX_LIGHT_CALLS_PER_HOUR=100" >> .env.local
   ```

4. **Update Vercel**:
   ```bash
   vercel env rm GOOGLE_API_KEY production
   vercel env add GOOGLE_API_KEY production
   # Paste your NEW key when prompted
   ```

### ⚠️ STEP 2: Rotate Vercel Blob Token

1. **Go to Vercel Dashboard**:
   - Visit: https://vercel.com/dashboard/stores
   - Find your Blob storage
   - Click "Regenerate Token"

2. **Update everywhere**:
   ```bash
   # Update .env.local with NEW token
   echo "BLOB_READ_WRITE_TOKEN=YOUR_NEW_TOKEN" >> .env.local
   
   # Update Vercel
   vercel env rm BLOB_READ_WRITE_TOKEN production
   vercel env add BLOB_READ_WRITE_TOKEN production
   ```

### ⚠️ STEP 3: Rotate Google Cloud Service Account

1. **Disable the exposed service account**:
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Find the exposed service account
   - Click "Disable" or "Delete"

2. **Create new service account**:
   ```bash
   # In Google Cloud Console:
   # IAM & Admin → Service Accounts → Create Service Account
   # Grant "Cloud Text-to-Speech API User" role
   # Create and download new key.json
   ```

3. **Update locally**:
   ```bash
   # Replace key.json with the NEW downloaded file
   # Add to .env.local:
   GOOGLE_TTS_SA_JSON='<paste entire JSON from new key.json file>'
   ```

### ⚠️ STEP 4: Clean Git History

⚠️ **WARNING**: This rewrites git history. Coordinate with team first!

```bash
# Option 1: Using BFG Repo Cleaner (Recommended)
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Backup first!
cp -r . ../AI-TeleSuite-backup

# Remove files from history
bfg --delete-files .env.local
bfg --delete-files key.json

# Clean up and force push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all

# Option 2: Using git filter-repo (Alternative)
# Install: pip install git-filter-repo
git filter-repo --path .env.local --invert-paths
git filter-repo --path key.json --invert-paths
git push origin --force --all
```

### ⚠️ STEP 5: Commit the Security Fix

```bash
cd /Users/Anchit.Tandon/Desktop/AI\ HUSTLE\ -\ APPS/AI-TeleSuite

# Files already removed from tracking
git add .gitignore SECURITY_INCIDENT.md
git commit -m "🔒 SECURITY: Remove exposed API keys and service account credentials

- Removed .env.local from git tracking
- Removed key.json from git tracking
- Added security incident documentation
- ACTION REQUIRED: Rotate all exposed credentials immediately"

git push origin main
```

## Impact Assessment

### Exposed Services
- ✅ Google Cloud APIs (Gemini AI, Text-to-Speech)
- ✅ Vercel Blob Storage
- ✅ Full Google Cloud Project Access (via service account)

### Potential Risks
- **Financial**: Unlimited API usage could rack up charges
- **Data**: Potential access to stored blobs and cloud resources
- **Quota**: Malicious users could exhaust API quotas

### Who Can See This?
- ❌ **Public on GitHub**: Repository is public, anyone can see commit history
- ❌ **Git History**: All commits with these keys are visible
- ❌ **Forks & Clones**: Anyone who forked/cloned has the keys

## Prevention Measures Implemented

### 1. Enhanced .gitignore
Already in place:
```gitignore
.env
.env.local
.env*.local
key.json
*.pem
*.key
```

### 2. Pre-commit Hook (RECOMMENDED)
Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Check for secrets before committing

if git diff --cached --name-only | grep -E '\.env|key\.json'; then
  echo "❌ ERROR: Attempting to commit secret files!"
  echo "Files blocked: .env.local, key.json"
  exit 1
fi

# Check for API keys in content
if git diff --cached | grep -E 'AIza[0-9A-Za-z_-]{35}|sk-[0-9A-Za-z]{48}'; then
  echo "❌ ERROR: API key detected in commit!"
  exit 1
fi

exit 0
```

### 3. GitHub Secret Scanning
Enable in repository settings:
- Settings → Code security and analysis → Secret scanning

## Verification Checklist

After rotating credentials:

- [ ] Old Google API key is deleted from Google Cloud Console
- [ ] New Google API key is working locally
- [ ] New Google API key is deployed to Vercel
- [ ] Old Vercel Blob token is regenerated
- [ ] New Vercel Blob token is working
- [ ] Old service account is disabled
- [ ] New service account is configured
- [ ] `.env.local` is not tracked by git (`git status` shows nothing)
- [ ] `key.json` is not tracked by git
- [ ] Pre-commit hook is installed
- [ ] Test all features: transcription, TTS, call scoring
- [ ] Monitor Google Cloud billing for suspicious activity
- [ ] Monitor Vercel usage for suspicious activity

## Long-term Security Improvements

1. **Use Environment Variables Only**
   - Never commit `.env` files
   - Use Vercel environment variables for production
   - Use `.env.local` for local development only

2. **Secret Management**
   - Consider using a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Rotate credentials regularly (quarterly)

3. **Access Controls**
   - Use service accounts with minimal permissions
   - Enable API key restrictions (IP, HTTP referrer, API)
   - Set up billing alerts

4. **Monitoring**
   - Enable Cloud Audit Logs
   - Set up alerts for unusual API usage
   - Monitor billing dashboards

## Contact

If you notice any suspicious activity:
- Check Google Cloud Console → Billing
- Check Vercel Dashboard → Usage
- Immediately disable affected credentials

---

**Last Updated**: November 8, 2025  
**Status**: Files removed from tracking. CREDENTIALS MUST BE ROTATED IMMEDIATELY!

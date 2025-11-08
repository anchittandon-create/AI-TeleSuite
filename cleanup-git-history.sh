#!/bin/bash

# Security Cleanup Automation Script
# This script helps automate the git history cleanup process
# 
# ⚠️ WARNING: This script will rewrite git history!
# ⚠️ Make sure you have a backup before running this!

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}======================================${NC}"
echo -e "${RED}  GIT HISTORY CLEANUP SCRIPT${NC}"
echo -e "${RED}======================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will rewrite git history!${NC}"
echo -e "${YELLOW}⚠️  Make sure you have a backup!${NC}"
echo ""

# Confirm backup exists
read -p "Have you created a backup of this repository? (yes/no): " backup_confirm
if [ "$backup_confirm" != "yes" ]; then
    echo -e "${RED}❌ Please create a backup first!${NC}"
    echo "Run: cp -r . ../AI-TeleSuite-backup-\$(date +%Y%m%d-%H%M%S)"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Backup confirmed${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository!${NC}"
    exit 1
fi

# Check if BFG is installed
echo "Checking for BFG Repo Cleaner..."
if ! command -v bfg &> /dev/null; then
    echo -e "${YELLOW}⚠️  BFG not found. Installing...${NC}"
    
    # Detect OS and install
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install bfg
        else
            echo -e "${RED}❌ Homebrew not found. Please install BFG manually:${NC}"
            echo "https://rtyley.github.io/bfg-repo-cleaner/"
            exit 1
        fi
    else
        echo -e "${RED}❌ Please install BFG manually:${NC}"
        echo "https://rtyley.github.io/bfg-repo-cleaner/"
        exit 1
    fi
fi

echo -e "${GREEN}✓ BFG is installed${NC}"
echo ""

# Show files to be removed
echo -e "${YELLOW}Files to be removed from history:${NC}"
echo "  - .env.local"
echo "  - key.json"
echo ""

read -p "Continue with cleanup? (yes/no): " cleanup_confirm
if [ "$cleanup_confirm" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting cleanup...${NC}"
echo ""

# Step 1: Remove .env.local from history
echo "Removing .env.local from git history..."
bfg --delete-files .env.local

# Step 2: Remove key.json from history
echo "Removing key.json from git history..."
bfg --delete-files key.json

echo -e "${GREEN}✓ Files removed from history${NC}"
echo ""

# Step 3: Clean up repository
echo "Cleaning up repository..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo -e "${GREEN}✓ Repository cleaned${NC}"
echo ""

# Step 4: Verify files are gone
echo "Verifying cleanup..."
echo ""

# Check .env.local
if git log --all --full-history -- .env.local 2>&1 | grep -q "commit"; then
    echo -e "${RED}⚠️  WARNING: .env.local still found in history!${NC}"
else
    echo -e "${GREEN}✓ .env.local removed from history${NC}"
fi

# Check key.json
if git log --all --full-history -- key.json 2>&1 | grep -q "commit"; then
    echo -e "${RED}⚠️  WARNING: key.json still found in history!${NC}"
else
    echo -e "${GREEN}✓ key.json removed from history${NC}"
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  CLEANUP COMPLETE${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

# Prompt for force push
echo -e "${RED}⚠️  NEXT STEP: Force push to remote${NC}"
echo ""
echo "This will OVERWRITE the history on GitHub!"
echo "Anyone who has cloned this repo will need to delete and re-clone."
echo ""
read -p "Force push to origin now? (yes/no): " push_confirm

if [ "$push_confirm" == "yes" ]; then
    echo ""
    echo "Force pushing to origin/main..."
    git push origin main --force
    
    echo ""
    echo "Force pushing all branches..."
    git push origin --force --all
    
    echo ""
    echo -e "${GREEN}✓ Force push complete${NC}"
    echo ""
else
    echo ""
    echo -e "${YELLOW}Skipping force push${NC}"
    echo "Run manually when ready:"
    echo "  git push origin main --force"
    echo "  git push origin --force --all"
    echo ""
fi

# Final verification
echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  FINAL VERIFICATION${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""

echo "Searching for exposed API keys in history..."
if git rev-list --all | xargs git grep -i 'AIzaSyBBL3roRt5nqsiXDMzd8zXTpB9TB_7jdGQ' 2>&1 | grep -q "AIza"; then
    echo -e "${RED}❌ WARNING: Google API key still found in history!${NC}"
else
    echo -e "${GREEN}✓ Google API key not found in history${NC}"
fi

if git rev-list --all | xargs git grep -i 'vercel_blob_rw_bkO0d1ptF0jWiSJU' 2>&1 | grep -q "vercel_blob"; then
    echo -e "${RED}❌ WARNING: Vercel token still found in history!${NC}"
else
    echo -e "${GREEN}✓ Vercel token not found in history${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  SCRIPT COMPLETE${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

echo "NEXT STEPS (CRITICAL!):"
echo ""
echo "1. ⚠️  ROTATE ALL CREDENTIALS IMMEDIATELY:"
echo "   - Google API Key: https://console.cloud.google.com/apis/credentials"
echo "   - Vercel Blob Token: https://vercel.com/dashboard/stores"
echo "   - Service Account: https://console.cloud.google.com/iam-admin/serviceaccounts"
echo ""
echo "2. Update Vercel environment variables:"
echo "   vercel env rm GOOGLE_API_KEY production"
echo "   vercel env add GOOGLE_API_KEY production"
echo ""
echo "3. Test application with new credentials"
echo ""
echo "4. Set up pre-commit hooks to prevent future issues"
echo ""
echo "5. Notify collaborators to delete and re-clone"
echo ""

echo -e "${RED}DO NOT SKIP CREDENTIAL ROTATION!${NC}"
echo ""

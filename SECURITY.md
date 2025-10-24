# Security Checklist for AI-TeleSuite

## ✅ API Key Security

### Local Development
- [ ] `.env` file removed from git tracking
- [ ] `.env.local` exists with actual API keys (gitignored)
- [ ] `.env.example` provides template without real keys
- [ ] No hardcoded API keys in source code

### Production Deployment (Vercel)
- [ ] Environment variables configured in Vercel dashboard
- [ ] `GOOGLE_API_KEY` set for server-side operations
- [ ] `NEXT_PUBLIC_GOOGLE_API_KEY` set for client-side TTS
- [ ] All sensitive files ignored in .gitignore

### Git Security
- [ ] `.env` files are in .gitignore
- [ ] `key.json` files are in .gitignore
- [ ] No API keys committed to repository
- [ ] Documentation uses placeholder values only

## ✅ AI Model Configuration

- [ ] Genkit API version set to `v1beta`
- [ ] Model names use correct format: `googleai/gemini-1.5-flash-001`
- [ ] Fallback models configured for reliability
- [ ] Cost optimization models selected

## 🚨 Red Flags to Avoid

❌ Never commit files containing:
- API keys starting with `AIzaSy`
- GitHub tokens starting with `ghp_`
- Firebase service account keys (`key.json`)
- Any `.env` files with real values

❌ Never expose in public repositories:
- Database connection strings
- Service account credentials
- OAuth client secrets
- Third-party API keys

## 🔒 Best Practices

1. **Rotate Keys Regularly**: Change API keys every 90 days
2. **Principle of Least Privilege**: Only grant necessary permissions
3. **Monitor Usage**: Track API usage for anomalies
4. **Environment Separation**: Use different keys for dev/staging/prod
5. **Backup Access**: Keep secure backup of critical keys

## 📋 Verification Commands

```bash
# Check for exposed secrets in git history
git log --all --grep="API" --grep="key" --oneline

# Scan for potential API keys in codebase
grep -r "AIzaSy" . --exclude-dir=node_modules --exclude-dir=.git

# Verify .gitignore is working
git status --ignored

# Test environment variables
npm run dev # Should load without API key errors
```

## 🆘 If Keys Are Compromised

1. **Immediately** revoke the exposed keys in Google Cloud Console
2. Generate new API keys
3. Update environment variables in all environments
4. Consider rotating related credentials
5. Review git history and notify team if needed

---

Last Updated: October 25, 2025
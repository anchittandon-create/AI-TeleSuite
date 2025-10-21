import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env file manually
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          envVars[key.trim()] = value.slice(1, -1);
        } else {
          envVars[key.trim()] = value;
        }
      }
    });

    Object.assign(process.env, envVars);
    console.log('✅ Loaded environment variables from .env file');
  } catch (error) {
    console.error('❌ Failed to load .env file:', error.message);
  }
}

// Test the API key by making a simple request
async function testApiKey() {
  loadEnv();

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY environment variable is not set');
    return;
  }

  console.log('🔍 Testing Google AI API key...');
  console.log('API Key starts with:', apiKey.substring(0, 10) + '...');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent('Say "Hello, API key is working!" in exactly those words.');
    const response = await result.response;
    const text = response.text();

    if (text.includes('Hello, API key is working!')) {
      console.log('✅ API key is valid and working!');
    } else {
      console.log('⚠️ API key responded but with unexpected content:', text);
    }
  } catch (error) {
    console.error('❌ API key test failed:', error.message);

    if (error.message.includes('API_KEY_INVALID')) {
      console.error('💡 The API key appears to be invalid or revoked');
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      console.error('💡 The API key has exceeded its quota');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('💡 The API key does not have the required permissions');
    }
  }
}

testApiKey();

import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not found";
  if (key.length < 10) return "Too short to mask (should be much longer)";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const googleApiKeyFromEnv = process.env.GOOGLE_API_KEY;
const geminiApiKeyFromEnv = process.env.GEMINI_API_KEY; 
const googleAppCredsFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log(`\n--- API Key & Genkit Initialization Log (src/ai/genkit.ts) ---`);
console.log(`Attempting to read GOOGLE_API_KEY from environment (used by Cloud TTS client if ADC not set, and potentially by Genkit's GoogleAI plugin if GEMINI_API_KEY is not set): Value (masked) = ${getMaskedApiKey(googleApiKeyFromEnv)}`);
console.log(`Attempting to read GEMINI_API_KEY from environment (primary for Genkit's GoogleAI plugin - Gemini LLMs): Value (masked) = ${getMaskedApiKey(geminiApiKeyFromEnv)}`);
console.log(`Attempting to read GOOGLE_APPLICATION_CREDENTIALS from environment (primary for Cloud TTS client and other Google Cloud services): Value = ${googleAppCredsFromEnv ? "Set (path to JSON key file)" : "Not set"}`);


// Effective API key for Genkit's Google AI plugin (primarily for LLMs like Gemini)
// It will prioritize GEMINI_API_KEY if set, or use GOOGLE_API_KEY if GEMINI_API_KEY is not.
const effectiveGenkitApiKeyForLLMs = geminiApiKeyFromEnv || googleApiKeyFromEnv;

if (!effectiveGenkitApiKeyForLLMs) {
  const apiKeyErrorMessage = `
🚨🚨🚨 CRITICAL STARTUP WARNING: Neither GOOGLE_API_KEY NOR GEMINI_API_KEY is SET in the environment variables. 🚨🚨🚨
🔴 AI features powered by Google AI models (Gemini for LLM tasks) WILL LIKELY FAIL if Genkit cannot find credentials.
🔴 To resolve this for LLMs:
🔴 1. Ensure a .env file exists in the root directory of your project.
🔴 2. In the .env file, add EITHER:
🔴    GEMINI_API_KEY=your_actual_gemini_api_key_for_llms_here
🔴    OR if using a general key,
🔴    GOOGLE_API_KEY=your_actual_google_cloud_api_key_with_gemini_permissions_here
🔴 3. For the Cloud Text-to-Speech client (in speech-synthesis-flow.ts), it's STRONGLY RECOMMENDED to use:
🔴    GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
🔴    (And ensure GOOGLE_API_KEY is also set if that key is for TTS API access and not covered by the service account.)
🔴 4. You MUST RESTART your Next.js development server after creating/modifying the .env file.
🔴 (Stop it with Ctrl+C in the terminal, then run 'npm run dev' or your usual start command).
🔴 The application will attempt to proceed, but AI functionality will be broken until this is fixed.
--- End of API Key Warning ---
`;
  console.error(apiKeyErrorMessage);
} else {
  console.log(`✅ An API key for Genkit's GoogleAI plugin (for LLMs) was found in environment variables. Effective Key (masked) = ${getMaskedApiKey(effectiveGenkitApiKeyForLLMs)}`);
}
if (!googleAppCredsFromEnv && !googleApiKeyFromEnv) {
    console.warn(`🟡 WARNING: GOOGLE_APPLICATION_CREDENTIALS is NOT SET and GOOGLE_API_KEY is NOT SET. The Cloud Text-to-Speech client (in speech-synthesis-flow.ts) will likely fail to authenticate. It primarily relies on GOOGLE_APPLICATION_CREDENTIALS.`);
} else if (googleAppCredsFromEnv) {
    console.log(`✅ GOOGLE_APPLICATION_CREDENTIALS is SET. Cloud Text-to-Speech client will attempt to use these service account credentials.`);
} else if (googleApiKeyFromEnv) {
    console.log(`ℹ️ GOOGLE_API_KEY is SET (and GOOGLE_APPLICATION_CREDENTIALS is not). Cloud Text-to-Speech client *may* attempt to use this key. Ensure it has Text-to-Speech API permissions and the API is enabled & billed for your project.`);
}
console.log(`--- End of API Key & Credentials Status Check ---`);


let aiInstance: any;

try {
  console.log("Attempting to initialize Genkit with googleAI() plugin for LLMs...");
  // The googleAI() plugin primarily uses its API key for Gemini models.
  // It doesn't directly configure the @google-cloud/text-to-speech client.
  aiInstance = genkit({
    plugins: [
      googleAI() // This will use the API key from process.env (GEMINI_API_KEY or GOOGLE_API_KEY) for LLMs
    ],
  });
  console.log("✅✅✅ Genkit initialized SUCCESSFULLY with the Google AI plugin (for LLMs like Gemini).");
  if (effectiveGenkitApiKeyForLLMs) {
    console.log("      It should now be using the API key (GEMINI_API_KEY or GOOGLE_API_KEY) found in your environment variables for LLM calls.");
  } else {
    console.warn("      CAUTION: Genkit (LLM plugin) initialized, but no API key was explicitly found by the pre-check for LLMs. If you are using Application Default Credentials (e.g., in a Google Cloud environment that Genkit can detect), this *might* be okay. Otherwise, LLM calls will likely fail if the plugin cannot find credentials implicitly.");
  }
  console.info("      Note: The Cloud Text-to-Speech client (in speech-synthesis-flow.ts) has its own authentication requirements (preferably GOOGLE_APPLICATION_CREDENTIALS or a GOOGLE_API_KEY with TTS permissions). See logs above for its status.");

} catch (error) {
  const genkitError = error as GenkitError;
  console.error(`\n🔥🔥🔥 GENKIT PLUGIN INITIALIZATION FAILED! (src/ai/genkit.ts) 🔥🔥🔥`);
  console.error(`---------------------------------------------------------------------`);
  console.error(`🔴🔴🔴 THE LLM-BASED AI FEATURES OF THIS APPLICATION (Pitch Gen, Rebuttals, Scoring, etc.) WILL NOT WORK UNTIL THIS IS RESOLVED. 🔴🔴🔴`);
  console.error(`---------------------------------------------------------------------`);

  let errorMessage = "Unknown error during Genkit initialization.";
  if (error instanceof Error) {
    errorMessage = error.message;
    console.error(`  Error Type: ${error.name}`);
    console.error(`  Message: ${error.message}`);
    if (error.stack) console.error(`  Stack Trace (first few lines): ${error.stack.split('\n').slice(0,5).join('\n')}`);
    if (genkitError.detail) console.error(`  Details: ${JSON.stringify(genkitError.detail, null, 2)}`);
    if (genkitError.cause) console.error(`  Cause: ${genkitError.cause}`);
  } else {
    errorMessage = String(error);
    console.error(`  Error object (not an Error instance): ${String(error)}`);
  }

  console.error(`\n👉 This often happens if the GEMINI_API_KEY (or GOOGLE_API_KEY if GEMINI_API_KEY is not set for LLMs) is missing from your .env file, is invalid, or the associated Google Cloud project doesn't have the required AI APIs enabled (e.g., Gemini API / Generative Language API) and/or billing configured.`);
  console.error(`👉 Recap - Effective Genkit LLM Key (GEMINI_API_KEY or GOOGLE_API_KEY) from env (masked): ${getMaskedApiKey(effectiveGenkitApiKeyForLLMs)}`);
  console.error(`---------------------------------------------------------------------`);
  console.error(`👉 Review the error message above and the API key status reported at startup.`);
  console.error(`👉 Ensure relevant API keys are set in .env and valid, and Google Cloud project is configured.`);
  console.error(`---------------------------------------------------------------------`);
  
  const genkitFailureErrorMsg = `CRITICAL GENKIT INITIALIZATION FAILURE (for LLMs). AI features (Pitch Gen, Rebuttals, etc.) will be unavailable. Original Error from Genkit/Plugin: "${errorMessage}". This means Genkit (the AI framework for LLMs) could not start correctly. PLEASE CHECK SERVER LOGS (from src/ai/genkit.ts, usually printed just above this message during startup) for detailed diagnostic information. The MOST COMMON CAUSES are: 1. Your GEMINI_API_KEY (or GOOGLE_API_KEY if GEMINI_API_KEY is absent) is missing from the .env file, is invalid, or has insufficient permissions for Gemini/Generative Language API. 2. Issues with your Google Cloud project setup (e.g., the 'Generative Language API' or 'Vertex AI API' is not enabled, or billing is not configured correctly). You MUST fix this underlying environment or API key problem to proceed. Restart the server after making changes to .env. (Note: Text-to-Speech client initializes separately and might have its own errors if GOOGLE_APPLICATION_CREDENTIALS/GOOGLE_API_KEY for TTS is also misconfigured).`;

  aiInstance = {
    defineFlow: (config: any, fn: any) => {
      console.error(`🛑 Mock defineFlow called for ${config.name} due to Genkit (LLM plugin) initialization failure. This flow will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`🛑 Mock flow ${config.name} invoked, but Genkit (LLM plugin) initialization failed. Throwing error.`);
        throw new Error(`GenkitInitError: Flow '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    definePrompt: (config: any) => {
      console.error(`🛑 Mock definePrompt called for ${config.name} due to Genkit (LLM plugin) initialization failure. This prompt will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`🛑 Mock prompt ${config.name} invoked, but Genkit (LLM plugin) initialization failed. Throwing error.`);
        throw new Error(`GenkitInitError: Prompt '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    generate: async (options: any) => {
        console.error("🛑 Mock generate called, but Genkit (LLM plugin) initialization failed. Throwing error.");
        throw new Error(`GenkitInitError: Generate function cannot execute. ${genkitFailureErrorMsg}`);
    },
    defineTool: (config: any, fn: any) => {
        console.error(`🛑 Mock defineTool called for ${config.name} due to Genkit (LLM plugin) initialization failure. This tool will throw an error upon execution.`);
        return async (...args: any[]) => {
            console.error(`🛑 Mock tool ${config.name} invoked, but Genkit (LLM plugin) initialization failed. Throwing error.`);
            throw new Error(`GenkitInitError: Tool '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
        };
    },
    defineSchema: <T extends import('zod').ZodTypeAny>(name: string, schema: T) => {
        console.warn(`Mock defineSchema called for ${name}. Genkit (LLM plugin) may not be fully initialized. Returning schema as-is.`);
        return schema;
    },
  };
  console.warn("🛑🛑🛑 Assigned a placeholder 'ai' object due to Genkit (LLM plugin) initialization failure. AI features relying on LLMs will throw errors upon use. PLEASE CHECK SERVER LOGS ABOVE FOR THE ROOT CAUSE AND RESOLVE THE GENKIT INITIALIZATION ISSUE. 🛑🛑🛑");
}
console.log(`--- End of Genkit Initialization Log ---`);

export const ai = aiInstance;

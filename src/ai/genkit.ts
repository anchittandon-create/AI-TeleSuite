
import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Function to get a masked version of the API key for logging
const getMaskedApiKey = (key: string | undefined): string => {
  if (!key) return "Not found";
  if (key.length < 10) return "Too short to mask (should be much longer)";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const googleApiKey = process.env.GOOGLE_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

console.log(`\n--- API Key & Genkit Initialization Log (src/ai/genkit.ts) ---`);
console.log(`Attempting to read GOOGLE_API_KEY from environment: Value (masked) = ${getMaskedApiKey(googleApiKey)}`);
console.log(`Attempting to read GEMINI_API_KEY from environment: Value (masked) = ${getMaskedApiKey(geminiApiKey)}`);

let effectiveApiKey = googleApiKey || geminiApiKey;

if (!effectiveApiKey) {
  const apiKeyErrorMessage = `
🚨🚨🚨 CRITICAL STARTUP WARNING: GOOGLE_API_KEY or GEMINI_API_KEY is NOT SET in the environment variables. 🚨🚨🚨
🔴 AI features powered by Google AI models WILL FAIL.
🔴 To resolve this:
🔴 1. Ensure a .env file exists in the root directory of your project.
🔴 2. In the .env file, add the line: GOOGLE_API_KEY=your_actual_api_key_here (or GEMINI_API_KEY=...).
🔴 3. Replace "your_actual_api_key_here" with your valid Google AI API key.
🔴 4. CRITICAL: You MUST RESTART your Next.js development server after creating/modifying the .env file.
🔴 (Stop it with Ctrl+C in the terminal, then run 'npm run dev' or your usual start command).
🔴 The application will attempt to proceed, but AI functionality will be broken until this is fixed.
--- End of API Key Warning ---
`;
  console.error(apiKeyErrorMessage);
  // We will still attempt to initialize Genkit, and let it fail if the key is truly missing or fundamentally misconfigured.
  // The placeholder aiInstance below will handle calls if this initialization fails.
} else {
  console.log(`✅ An API key was found in the environment variables. Effective API Key (masked) = ${getMaskedApiKey(effectiveApiKey)}`);
  console.log(`   Proceeding with Genkit initialization using the found key.`);
  console.log(`--- End of API Key Presence Check ---`);
}


let aiInstance: any;

try {
  console.log("Attempting to initialize Genkit with googleAI() plugin...");
  aiInstance = genkit({
    plugins: [
      googleAI() // This will use the API key from process.env if set
    ],
    // Do not use logLevel here, it's deprecated in Genkit v1.x
    // enableTracingAndMetrics: true, // Optional: if you want to enable tracing
  });
  console.log("✅✅✅ Genkit initialized SUCCESSFULLY with the Google AI plugin.");
  if (effectiveApiKey) {
    console.log("      It should now be using the API key found in your environment variables.");
  } else {
    console.warn("      CAUTION: Genkit initialized, but no API key was explicitly found by the pre-check. If you are using Application Default Credentials in a Google Cloud environment, this *might* be okay. Otherwise, AI calls will likely fail if the plugin cannot find credentials implicitly.");
  }
} catch (error) {
  const genkitError = error as GenkitError;
  console.error(`\n🔥🔥🔥 GENKIT PLUGIN INITIALIZATION FAILED! 🔥🔥🔥`);

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

  console.error(`\n👉 This often happens if the GOOGLE_API_KEY/GEMINI_API_KEY is missing from your .env file, is invalid, or the associated Google Cloud project doesn't have the required AI APIs enabled (e.g., Gemini API / Generative Language API) and/or billing configured.`);
  console.error(`👉 Recap - GOOGLE_API_KEY from env (masked): ${getMaskedApiKey(googleApiKey)}`);
  console.error(`👉 Recap - GEMINI_API_KEY from env (masked): ${getMaskedApiKey(geminiApiKey)}`);
  
  const genkitFailureErrorMsg = `Genkit initialization failed. AI features will be unavailable. Reason: ${errorMessage}. Check server logs for detailed Genkit errors, ensure your GOOGLE_API_KEY (or GEMINI_API_KEY) is correctly set in the .env file, is valid, and your Google Cloud project is configured with the necessary APIs and billing.`;

  // Fallback aiInstance with methods that throw specific, identifiable errors
  aiInstance = {
    defineFlow: (config: any, fn: any) => {
      console.error(`🛑 Mock defineFlow called for ${config.name} due to Genkit initialization failure. This flow will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`🛑 Mock flow ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
        throw new Error(`GenkitInitError: Flow '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    definePrompt: (config: any) => {
      console.error(`🛑 Mock definePrompt called for ${config.name} due to Genkit initialization failure. This prompt will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`🛑 Mock prompt ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
        throw new Error(`GenkitInitError: Prompt '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    generate: async (options: any) => {
        console.error("🛑 Mock generate called, but Genkit initialization failed. Throwing error.");
        throw new Error(`GenkitInitError: Generate function cannot execute. ${genkitFailureErrorMsg}`);
    },
    defineTool: (config: any, fn: any) => {
        console.error(`🛑 Mock defineTool called for ${config.name} due to Genkit initialization failure. This tool will throw an error upon execution.`);
        return async (...args: any[]) => {
            console.error(`🛑 Mock tool ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
            throw new Error(`GenkitInitError: Tool '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
        };
    },
    defineSchema: <T extends import('zod').ZodTypeAny>(name: string, schema: T) => {
        console.warn(`Mock defineSchema called for ${name}. Genkit may not be fully initialized. Returning schema as-is.`);
        return schema;
    },
  };
  console.warn("🛑🛑🛑 Assigned a placeholder 'ai' object due to Genkit initialization failure. AI features will throw errors upon use. PLEASE CHECK SERVER LOGS ABOVE FOR THE ROOT CAUSE. 🛑🛑🛑");
}
console.log(`--- End of Genkit Initialization Log ---`);

export const ai = aiInstance;


import {genkit, type GenkitError} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Modified API key check: Log a warning but don't throw a fatal error.
// This allows the app to start, but AI features will fail if the key is truly missing/invalid.
if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  const apiKeyWarningMessage = `
🟡 WARNING: GOOGLE_API_KEY or GEMINI_API_KEY is not set in the environment variables.
🟡 AI features powered by Google AI models will likely FAIL.
🟡 For AI features to function, ensure one of these keys is set in a .env file:
🟡 1. Create a .env file in the root of your project.
🟡 2. Add the line: GOOGLE_API_KEY=your_actual_api_key_here (or GEMINI_API_KEY=...)
🟡 3. Replace "your_actual_api_key_here" with your valid Google AI API key.
🟡 4. IMPORTANT: Restart your Next.js development server (e.g., npm run dev).
`;
  console.warn(apiKeyWarningMessage);
}

let aiInstance: any;

try {
  aiInstance = genkit({
    plugins: [
      googleAI() 
    ],
  });
  console.log("✅ Genkit initialized with Google AI plugin. Note: Actual functionality depends on a valid API key.");
} catch (error) {
  const genkitError = error as GenkitError; // Keep type assertion for potential GenkitError properties
  console.error(`\n🔥🔥🔥 GENKIT PLUGIN INITIALIZATION FAILED! 🔥🔥🔥`);
  
  let errorMessage = "Unknown error during Genkit initialization.";
  if (error instanceof Error) {
    errorMessage = error.message;
    console.error(`  Error Type: ${error.name}`);
    console.error(`  Message: ${error.message}`);
    if (error.stack) console.error(`  Stack: ${error.stack}`);
    // Check for GenkitError specific properties
    if (genkitError.details) console.error(`  Details: ${JSON.stringify(genkitError.details, null, 2)}`);
    if (genkitError.cause) console.error(`  Cause: ${genkitError.cause}`);
  } else {
    // Handle cases where the thrown item might not be an Error instance
    errorMessage = String(error);
    console.error(`  Error object (not an Error instance): ${String(error)}`);
  }
  
  console.error(`\n👉 If GOOGLE_API_KEY/GEMINI_API_KEY is missing or invalid, AI features will not work. If it's present, ensure it's valid and the associated Google Cloud project has the necessary AI APIs enabled and billing configured.`);
  
  const genkitFailureErrorMsg = "Genkit initialization failed. AI feature unavailable. Check server logs for Genkit initialization errors, and ensure GOOGLE_API_KEY is correctly set in .env and valid.";

  aiInstance = {
    defineFlow: (config: any, fn: any) => {
      console.error(`Mock defineFlow called for ${config.name} due to Genkit initialization failure. This flow will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`Mock flow ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
        throw new Error(`GenkitInitError: Flow '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    definePrompt: (config: any) => {
      console.error(`Mock definePrompt called for ${config.name} due to Genkit initialization failure. This prompt will throw an error upon execution.`);
      return async (...args: any[]) => {
        console.error(`Mock prompt ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
        // Prompts usually return { output: ... } or just the output.
        // Throwing an error is cleaner for the outer catch.
        throw new Error(`GenkitInitError: Prompt '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
      };
    },
    generate: async (options: any) => {
        console.error("Mock generate called, but Genkit initialization failed. Throwing error.");
        throw new Error(`GenkitInitError: Generate function cannot execute. ${genkitFailureErrorMsg}`);
    },
    defineTool: (config: any, fn: any) => {
        console.error(`Mock defineTool called for ${config.name} due to Genkit initialization failure. This tool will throw an error upon execution.`);
        return async (...args: any[]) => { 
            console.error(`Mock tool ${config.name} invoked, but Genkit initialization failed. Throwing error.`);
            throw new Error(`GenkitInitError: Tool '${config.name}' cannot execute. ${genkitFailureErrorMsg}`);
        };
    },
    defineSchema: <T extends import('zod').ZodTypeAny>(name: string, schema: T) => {
        console.warn(`Mock defineSchema called for ${name}. Genkit may not be fully initialized. Returning schema as-is.`);
        return schema; 
    },
  };
  console.warn("Assigned a placeholder 'ai' object due to Genkit initialization failure. AI features will throw errors upon use.");
}

export const ai = aiInstance;

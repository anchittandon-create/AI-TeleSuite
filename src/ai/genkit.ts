
// import {genkit, type GenkitError} from 'genkit';
// import {googleAI} from '@genkit-ai/googleai';

// // Explicit API key check. This is crucial.
// if (!process.env.GOOGLE_API_KEY) {
//   const apiKeyErrorMessage = `
// 🔴 CRITICAL ERROR: GOOGLE_API_KEY is not set in the environment variables.
// 🔴 This key is REQUIRED for the AI features to function.
// 🔴 1. Create a .env file in the root of your project.
// 🔴 2. Add the line: GOOGLE_API_KEY=your_actual_api_key_here
// 🔴 3. Replace "your_actual_api_key_here" with your valid Google AI API key.
// 🔴 4. IMPORTANT: Restart your Next.js development server (e.g., npm run dev).
// `;
//   console.error(apiKeyErrorMessage);
//   // Throwing an error here will make it very clear in the server logs
//   // if the server fails to start due to a missing API key.
//   throw new Error(
//     'CRITICAL: GOOGLE_API_KEY is not set. AI features cannot initialize. Please check server logs for details.'
//   );
// }

// let aiInstance: any;

// try {
//   aiInstance = genkit({
//     plugins: [
//       googleAI() // This can throw if the API key is invalid or service is unavailable
//     ],
//     model: 'googleai/gemini-2.0-flash', // Default model
//   });
//   console.log("✅ Genkit initialized successfully with Google AI plugin.");
// } catch (error) {
//   const genkitError = error as GenkitError;
//   console.error(`\n🔥🔥🔥 GENKIT INITIALIZATION FAILED! 🔥🔥🔥`);
//   console.error(`Error initializing Genkit or the GoogleAI plugin. This usually means:`);
//   console.error(`  1. The GOOGLE_API_KEY is present but invalid, expired, or restricted.`);
//   console.error(`  2. The Google Cloud project associated with the key doesn't have the required AI APIs enabled (e.g., Generative Language API for Gemini).`);
//   console.error(`  3. There might be billing issues with your Google Cloud project.`);
//   console.error(`  4. Network connectivity issues preventing connection to Google AI services.`);
//   console.error(`\nOriginal Error Details:`);
//   if (genkitError.message) console.error(`  Message: ${genkitError.message}`);
//   if (genkitError.stack) console.error(`  Stack: ${genkitError.stack}`);
//   if (genkitError.details) console.error(`  Details: ${JSON.stringify(genkitError.details, null, 2)}`);
//   if (genkitError.cause) console.error(`  Cause: ${genkitError.cause}`);
  
//   console.error(`\n👉 Please verify your GOOGLE_API_KEY in .env and your Google Cloud project settings.`);
  
//   // Re-throw the error to ensure the server fails clearly if Genkit can't start.
//   // This helps in not running a partially functional server.
//   throw new Error(
//     `Genkit initialization failed: ${genkitError.message || 'Unknown error during Genkit setup'}. Check server logs.`
//   );
// }

// export const ai = aiInstance;

// Placeholder export to prevent import errors in flow files (though flows will be disabled)
export const ai = {
    definePrompt: (config: any) => {
        console.warn("Genkit definePrompt called, but Genkit is removed. Returning placeholder.");
        return async (input: any) => ({ output: null, error: "Genkit removed" });
    },
    defineFlow: (config: any, flowLogic: any) => {
        console.warn("Genkit defineFlow called, but Genkit is removed. Returning placeholder.");
        return async (input: any) => { throw new Error("Genkit is removed, flow cannot execute."); };
    },
    generate: async (params: any) => {
        console.warn("Genkit generate called, but Genkit is removed. Returning placeholder error.");
        return { text: () => "Error: Genkit removed.", error: "Genkit removed" };
    }
};


'use server';
/**
 * @fileOverview A resilient and efficient, rubric-based call scoring analysis flow.
 * This flow provides a multi-dimensional analysis of a sales call based on a comprehensive set of metrics.
 * It now includes a robust retry mechanism with exponential backoff to handle API rate limits.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { Product } from '@/types';
import { ScoreCallInputSchema, ScoreCallOutputSchema, ImprovementSituationSchema } from '@/types';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';
import { transcribeAudio } from './transcription-flow';


// This is the schema the AI will be asked to generate. It omits fields that are added post-generation.
const ScoreCallGenerationOutputSchema = ScoreCallOutputSchema.omit({
    transcript: true,
    transcriptAccuracy: true,
});
type ScoreCallGenerationOutput = z.infer<typeof ScoreCallGenerationOutputSchema>;


const scoringPromptText = `You are an EXHAUSTIVE and DEEPLY ANALYTICAL telesales call quality analyst. Your task is to perform a top-quality, detailed analysis of a sales call based on the provided transcript, a strict multi-faceted rubric, and the detailed product context. Do NOT summarize or provide superficial answers. Provide detailed, actionable evaluation under EACH metric.

Your output must be a single, valid JSON object that strictly conforms to the required schema. For EACH metric listed below, provide a score (1-5) and detailed feedback in the 'metricScores' array. Your feedback MUST reference the provided Product Context when evaluating product-related metrics.

**EVALUATION RUBRIC (Metrics to score):**

*   **Call Opening:** Was there a strong, immediate hook?
*   **Greeting & Introduction:** Was the brand, agent, and intent clear?
*   **Call Structuring:** Was the flow logical (intro, discovery, pitch, close)?
*   **Segue Smoothness:** Were transitions between topics smooth?
*   **Time Management:** Was the call length optimal?
*   **Voice Tone:** Was the tone appropriate for the user persona (inferred from text)?
*   **Energy Level:** Was energy consistent and enthusiastic (inferred from text)?
*   **Pitch & Modulation:** Were changes in pitch used for emphasis (inferred from text)?
*   **Clarity of Speech:** Were words clear, without mumbling?
*   **Filler Usage:** Was there excessive use of "uh", "like", "you know"?
*   **Hindi-English Switching:** Was language used fluidly to enhance comfort?
*   **Persona Identification:** Did the agent identify the user type (student, investor, etc.)?
*   **Probing Depth:** Were insightful questions asked to unearth needs?
*   **Active Listening:** Did the agent acknowledge and react to user inputs?
*   **Relevance Alignment:** Was the pitch shaped based on identified user needs?
*   **Value Proposition:** Were product benefits presented clearly and powerfully, referencing the Product Context?
*   **Feature-to-Need Fit:** Were features (from Product Context) mapped to user pain points?
*   **Use of Quantifiable Value:** Were value claims (e.g., plan discounts, bundle savings from Product Context) referenced?
*   **Emotional Triggers:** Were FOMO, productivity, or credibility triggers (from Product Context) used?
*   **Time Saving Emphasis:** Was the user shown how the product saves time, as per the Product Context?
*   **Content Differentiation:** Was the product positioned as superior to free alternatives, using points from the Product Context?
*   **Price Objection Response:** Was the value framed confidently against the price?
*   **Relevance Objection:** Was "I don’t need it" tackled effectively using product benefits?
*   **Content Overlap Objection:** Was duplication with free news handled?
*   **Indecision Handling:** Was fence-sitting detected and addressed?
*   **Pushback Pivoting:** Were objections converted into renewed pitch angles?
*   **Plan Breakdown Clarity:** Were plans and pricing explained clearly (if mentioned in transcript)?
*   **Bundle Leveraging:** Were bonuses like Times Prime, DocuBay (from Product Context) explained?
*   **Scarcity/Urgency Use:** Was limited-time offer framing used?
*   **Assumptive Closing:** Did the agent behave as if the user will convert?
*   **Call-to-Action Strength:** Was the closing question strong and direct?
*   **Summarization:** Was there a quick recap at the end?
*   **Next Step Clarity:** Was it clear what the user should do next?
*   **Closing Tone:** Was the final tone polite and confident?
*   **User Response Pattern:** Did the user give buying signals?
*   **Hesitation Patterns:** Was hesitation spotted and worked on?
*   **Momentum Building:** Did the call peak at the right time?
*   **Conversion Readiness:** What is the final conversion readiness (Low/Medium/High)?
*   **Agent's Tone & Professionalism:** Overall assessment of the agent's tone.
*   **User's Perceived Sentiment:** Overall assessment of the user's sentiment.

**FINAL OUTPUT SECTIONS (Top-level fields):**
- **overallScore:** Calculate the average of all individual metric scores.
- **callCategorisation:** Categorize the call (Excellent, Good, Average, Needs Improvement, Poor) based on the overall score.
- **summary:** Provide a concise paragraph summarizing the call's key events and outcome.
- **strengths:** List the top 2-3 key strengths of the agent's performance.
- **areasForImprovement:** List the top 2-3 specific, actionable areas for improvement.
- **redFlags:** List any critical issues like compliance breaches, major mis-selling, or extremely poor customer service. If none, this should be an empty array.
- **metricScores:** An array containing an object for EACH metric from the rubric above, with 'metric', 'score', and 'feedback'.
- **improvementSituations**: Identify 2-4 specific moments in the call where the agent's response could have been significantly better. For each situation, you MUST provide:
    - **timeInCall**: The timestamp from the transcript for this moment (e.g., "[45 seconds - 58 seconds]").
    - **context**: A brief summary of the conversation topic at that moment.
    - **userDialogue**: The specific line of dialogue from the 'USER:' that the agent was responding to.
    - **agentResponse**: The agent's actual response in that situation.
    - **suggestedResponse**: The more suitable, improved response the agent could have used.

Your analysis must be exhaustive for every single point. No shortcuts.
`;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlowInternal',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    // This flow now expects a transcript to be provided.
    if (!input.transcriptOverride || input.transcriptOverride.trim().length < 10) {
        throw new Error("A valid transcript override of at least 10 characters must be provided to the call scoring flow.");
    }

    const transcript = input.transcriptOverride;
    const transcriptAccuracy = "Provided as Text";
    
    const finalPrompt = `${scoringPromptText}

**[CALL CONTEXT]**
- **Product Name:** ${input.product}
- **Agent Name (if provided):** ${input.agentName || 'Not Provided'}

**[PRODUCT CONTEXT - Your primary source for product knowledge]**
${input.productContext || 'No detailed product context was provided. Base your analysis on general knowledge of the product name and the transcript content.'}
**[END PRODUCT CONTEXT]**


**[TRANSCRIPT TO ANALYZE]**
\`\`\`
${transcript}
\`\`\`
**[END TRANSCRIPT]**`;
    
    const maxRetries = 3;
    const initialDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting full call scoring with primary model (Attempt ${attempt}/${maxRetries})`);
            const { output } = await ai.generate({
                model: 'googleai/gemini-1.5-flash-latest',
                prompt: finalPrompt,
                output: {
                    schema: ScoreCallGenerationOutputSchema,
                    format: 'json' as const,
                },
                config: { temperature: 0.2 },
            });

            if (!output) {
                throw new Error("Primary scoring model returned empty output.");
            }

            const finalOutput: ScoreCallOutput = {
              ...(output as ScoreCallGenerationOutput),
              transcript: transcript,
              transcriptAccuracy: transcriptAccuracy,
            };
            return finalOutput;

        } catch (e: any) {
            const errorMessage = e.message?.toLowerCase() || '';
            const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource has been exhausted');

            if (isRateLimitError && attempt < maxRetries) {
                const waitTime = initialDelay * Math.pow(2, attempt - 1);
                console.warn(`Attempt ${attempt} failed due to rate limit. Waiting for ${waitTime}ms before retrying.`);
                await delay(waitTime);
            } else {
                console.error(`Attempt ${attempt} failed with non-retriable error or after max retries:`, e.message);
                throw e; // Re-throw the error if it's not a rate limit issue or if we've exhausted retries
            }
        }
    }

    // This part should only be reached if all retries fail.
    throw new Error(`Failed to score call after ${maxRetries} attempts due to persistent rate limiting.`);
  }
);


// Wrapper function to handle potential errors and provide a consistent public API
export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    // Await the result of the flow. Any uncaught exception inside will be caught here.
    return await scoreCallFlow(input);
  } catch (err) {
    const error = err as Error;
    // Log the full error server-side for debugging
    console.error("Critical error in scoreCall flow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Create a user-friendly error message
    let errorMessage = `A critical system error occurred: ${error.message}. This may be due to server timeouts, network issues, or an internal AI service error.`;
    if (error.message.includes('429') || error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('resource has been exhausted')) {
        errorMessage = `The call scoring service is currently unavailable as the AI model is busy due to high demand. Please try again after some time or check your API plan and billing details.`;
    }
    
    // Create a simplified, flat error object that conforms to the ScoreCallOutputSchema
    // This ensures the client always receives a valid object and does not crash.
    return {
      transcript: (input.transcriptOverride || `[System Error during scoring process execution. Raw Error: ${error.message}]`),
      transcriptAccuracy: "System Error",
      overallScore: 0,
      callCategorisation: "Error",
      summary: errorMessage,
      strengths: ["N/A due to system error"],
      areasForImprovement: [`Investigate and resolve the critical system error: ${error.message.substring(0, 100)}...`],
      redFlags: [`System-level error occurred during scoring: ${error.message.substring(0,100)}...`],
      metricScores: [{
          metric: 'System Error',
          score: 1,
          feedback: errorMessage,
      }],
      improvementSituations: [],
    };
  }
}


'use server';

/**
 * @fileOverview Call scoring analysis flow. This version has hardened validation and more robust prompting as per specification.
 * - scoreCall - A function that handles the call scoring process.
 * - ScoreCallInput - The input type for the scoreCall function.
 * - ScoreCallOutput - The return type for the scoreCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product, CALL_SCORE_CATEGORIES, CallScoreCategory } from '@/types';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file of a call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  product: z.enum(PRODUCTS).optional().describe("The product (ET or TOI) that the call is primarily about. If omitted, a general sales call analysis is performed."),
  agentName: z.string().optional().describe('The name of the agent.'),
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const MetricScoreSchema = z.object({
  metric: z.string().describe("Name of the performance metric (e.g., 'Opening & Rapport Building', 'Needs Discovery', 'Product Presentation', 'Objection Handling', 'Closing Effectiveness', 'Clarity & Communication', 'Agent's Tone & Professionalism', 'User's Perceived Sentiment', 'Product Knowledge')."),
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().describe("Specific feedback, observations, or comments related to this metric, especially concerning the selected product and inferred tonality/sentiment.")
});

const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation (potentially diarized with speaker labels like "Agent:" or "User:"). Transcript will be in Roman script, possibly containing transliterated Hindi words.'),
  transcriptAccuracy: z.string().describe("The AI's qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium')."),
  overallScore: z.number().min(0).max(5).describe('The overall call score (0-5) based on all evaluated metrics.'),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment. Ensure 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are included as distinct metrics with scores and feedback."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.')
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;

// This schema is used for the AI generation step ONLY. It omits the transcript fields,
// which are added back before the final output to ensure the schema is always valid.
const ScoreCallGenerationOutputSchema = ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true });

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput, transcriptOverride?: string): Promise<ScoreCallOutput> => {
    let transcriptResult: TranscriptionOutput;

    // Step 1: Obtain the transcript.
    // This block handles transcription for audio files or uses a provided text transcript.
    if (transcriptOverride) {
      transcriptResult = {
        diarizedTranscript: transcriptOverride,
        accuracyAssessment: "Provided (from text)"
      };
    } else {
      try {
        transcriptResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
      } catch (transcriptionServiceError) {
        const err = transcriptionServiceError as Error;
        console.error("Critical error calling transcribeAudio service from scoreCallFlow:", err);
        const reason = `[Transcription Service Error: ${err.message}]`;
        return {
          transcript: reason,
          transcriptAccuracy: "Error",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [{ metric: "Transcription Service", score: 1, feedback: `Call scoring aborted due to a transcription service failure. Details: ${err.message}` }],
          summary: "Call scoring aborted. The transcription service failed and could not produce a transcript.",
          strengths: [],
          areasForImprovement: ["Verify the audio file is valid and not corrupted.", "Check the transcription service status."]
        };
      }
    }

    // Step 2: Validate the transcription result before proceeding to scoring.
    if (!transcriptResult || typeof transcriptResult.diarizedTranscript !== 'string' || transcriptResult.diarizedTranscript.toLowerCase().includes("[error") || transcriptResult.accuracyAssessment === "Error") {
        const reason = transcriptResult?.diarizedTranscript?.toString() || 'Unknown transcription error';
        return {
          transcript: `[Transcription Result Error: ${reason}]`,
          transcriptAccuracy: transcriptResult?.accuracyAssessment || "Error",
          overallScore: 0,
          callCategorisation: "Error",
          metricScores: [{ 
            metric: "Transcription Result", 
            score: 1, 
            feedback: `Call scoring aborted. A valid transcript could not be obtained. Reason: ${reason}` 
          }],
          summary: "Call scoring aborted. A valid transcript could not be obtained from the audio.",
          strengths: [],
          areasForImprovement: ["Review the audio file for clarity and length. If the issue persists, it may be a problem with the AI transcription model's ability to process this specific audio."]
        };
    }

    // Step 3: Proceed with scoring, now guaranteed to have a valid transcript.
    try {
      const productContext = input.product && input.product !== "General"
        ? `The call is regarding the product '${input.product}'. The 'Product Knowledge' and 'Product Presentation' metrics MUST be evaluated based on how well the agent explains and represents this specific product.`
        : "The call is a general sales call. The 'Product Knowledge' and 'Product Presentation' metrics should be evaluated based on general sales principles and how well the agent presents whatever product or service is being discussed, without needing specific pre-loaded knowledge of 'ET' or 'TOI'.";

      const scoringPromptText = `You are an expert call quality analyst and sales leader. Your task is to objectively and consistently score a sales call based on the provided transcript.
${productContext}
${input.agentName ? `The agent's name is ${input.agentName}.` : ''}

Transcript:
\`\`\`
${transcriptResult.diarizedTranscript}
\`\`\`

Based *strictly* on the transcript provided, you MUST evaluate the call and provide a score from 1 to 5 for each of the following key metrics. Your feedback must be specific and reference parts of the transcript if possible.

- **Opening & Rapport Building**: How well did the agent start the call and connect with the user?
- **Needs Discovery**: Did the agent ask questions to understand the user's needs or situation?
- **Product Presentation**: How effectively was the product presented in relation to the user's needs?
- **Objection Handling**: How well were objections or hesitations addressed?
- **Closing Effectiveness**: Was there a clear attempt to close the sale or define next steps?
- **Clarity & Communication**: How clear and professional was the agent's language?
- **Agent's Tone & Professionalism**: Based on word choice and phrasing, what was the agent's inferred tone (e.g., confident, hesitant, empathetic)?
- **User's Perceived Sentiment**: Based on the user's responses, what was their sentiment (e.g., interested, annoyed, confused)?
- **Product Knowledge**: How well did the agent demonstrate knowledge of the product they were selling?

After scoring each metric, provide a final **overallScore** (1-5), a **callCategorisation** ('Very Good', 'Good', 'Average', 'Bad', 'Very Bad'), a concise **summary**, 2-3 specific **strengths**, and 2-3 actionable **areasForImprovement**.
Be as objective as possible in your scoring. Your output must be a single, valid JSON object that strictly conforms to the required schema.
`;
      
      const primaryModel = 'googleai/gemini-1.5-flash-latest';
      const fallbackModel = 'googleai/gemini-2.0-flash';
      let scoringGenerationOutput;

      try {
        const { output } = await ai.generate({
            model: primaryModel,
            prompt: scoringPromptText,
            output: { schema: ScoreCallGenerationOutputSchema, format: "json" },
            config: { temperature: 0.2 }
        });
        scoringGenerationOutput = output;
      } catch (e: any) {
        if (e.message.includes('429') || e.message.toLowerCase().includes('quota')) {
            console.warn(`Primary model (${primaryModel}) failed due to quota. Attempting fallback to ${fallbackModel}.`);
            const { output } = await ai.generate({
                model: fallbackModel,
                prompt: scoringPromptText,
                output: { schema: ScoreCallGenerationOutputSchema, format: "json" },
                config: { temperature: 0.2 }
            });
            scoringGenerationOutput = output;
        } else {
            throw e;
        }
      }

      if (!scoringGenerationOutput) {
        throw new Error("AI failed to generate scoring details. The response from the scoring model was empty.");
      }

      // Step 4: Combine the successful scoring result with the validated transcript.
      const finalOutput: ScoreCallOutput = {
        ...scoringGenerationOutput,
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
      };
      return finalOutput;

    } catch (err) {
      const error = err as Error;
      console.error("Error in scoreCallFlow (AI scoring part):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      // Even in case of a scoring error, we return the successful transcript.
      return {
        transcript: transcriptResult.diarizedTranscript,
        transcriptAccuracy: transcriptResult.accuracyAssessment,
        overallScore: 0,
        callCategorisation: "Error",
        metricScores: [{ metric: "AI Scoring Model", score: 1, feedback: `The AI scoring model failed to process the transcript. Error: ${error.message}.` }],
        summary: `Scoring Failed: The AI model encountered an issue processing the transcript. Error: ${error.message}`,
        strengths: [],
        areasForImprovement: ["AI service for scoring might be unavailable or encountered an issue with the transcript. Check server logs."]
      };
    }
  }
);

export async function scoreCall(input: ScoreCallInput, transcriptOverride?: string): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input, transcriptOverride);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error caught in exported scoreCall function:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    const errorMessage = `A critical system error occurred in the scoring flow: ${error.message}. This is likely an issue with the AI service configuration, network, or an unexpected bug. Check server logs for the full error.`;
    return {
      transcript: transcriptOverride ?? `[System Error during scoring process execution. The flow failed unexpectedly. Raw Error: ${error.message}]`,
      transcriptAccuracy: "Unknown",
      overallScore: 0,
      callCategorisation: "Error",
      metricScores: [{ 
        metric: "System Execution", 
        score: 1, 
        feedback: errorMessage 
      }],
      summary: `Call scoring failed due to a critical system error. Details: ${error.message}`,
      strengths: [],
      areasForImprovement: ["Contact support or check server logs for critical system errors related to 'scoreCallFlow' execution."]
    };
  }
}


'use server';
/**
 * @fileOverview A rebuilt, resilient call scoring analysis flow. This version ensures robust
 * validation and a dual-model fallback for the scoring step to maximize reliability.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product, CALL_SCORE_CATEGORIES, CallScoreCategory } from '@/types';

const ScoreCallInputSchema = z.object({
  audioDataUri: z
    .string()
    .optional()
    .describe(
      "An audio file of a call recording, as a data URI. This is only required if transcriptOverride is not provided."
    ),
  transcriptOverride: z
    .string()
    .optional()
    .describe(
      "A pre-existing, diarized transcript string. If provided, this will be used for scoring, and the audioDataUri will be ignored."
    ),
  product: z.enum(PRODUCTS).optional().describe("The product (e.g., 'ET', 'TOI') that the call is primarily about. If omitted, a general sales call analysis is performed."),
  agentName: z.string().optional().describe('The name of the agent.'),
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

const MetricScoreSchema = z.object({
  metric: z.string().describe("Name of the performance metric (e.g., 'Opening & Rapport Building', 'Needs Discovery', 'Product Presentation', 'Objection Handling', 'Closing Effectiveness', 'Clarity & Communication', 'Agent's Tone & Professionalism', 'User's Perceived Sentiment', 'Product Knowledge', 'Filler Word Usage', 'Pacing and Speaking Rate')."),
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().describe("Specific feedback, observations, or comments related to this metric, especially concerning the selected product and inferred tonality/sentiment.")
});

const QuantitativeAnalysisSchema = z.object({
    talkToListenRatio: z.string().describe("Agent's talk-to-listen ratio (e.g., '60/40'). Inferred from transcript turn length and frequency. MUST provide an estimate."),
    longestMonologue: z.string().describe("Duration or length of the agent's longest speaking turn without interruption. MUST provide an estimate or description."),
    silenceAnalysis: z.string().describe("Analysis of silence or dead air in the conversation, noting if it was excessive or used effectively. MUST provide an analysis, even if it's 'Minimal dead air observed'.")
});


const ScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation (potentially diarized with speaker labels like "Agent:" or "User:"). Transcript will be in Roman script, possibly containing transliterated Hindi words.'),
  transcriptAccuracy: z.string().describe("The AI's qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium')."),
  overallScore: z.number().min(0).max(5).describe('The overall call score (0-5) based on all evaluated metrics.'),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES).describe("Overall category of the call performance (e.g., 'Very Good', 'Good', 'Average', 'Bad', 'Very Bad'). Provide a category that best reflects the overall score and performance."),
  metricScores: z.array(MetricScoreSchema).describe("An array of scores and feedback for specific performance metrics evaluated during the call. Include at least 7-9 key metrics relevant to sales calls, considering the product context, inferred tonality, and sentiment. Ensure 'Agent's Tone & Professionalism' and 'User's Perceived Sentiment' are included as distinct metrics with scores and feedback."),
  summary: z.string().describe("A brief overall summary of the call's effectiveness and outcome, including key discussion points related to the specified product, and overall sentiment observed."),
  strengths: z.array(z.string()).describe('List 2-3 key positive aspects or what was done well during the call, particularly regarding the product and agent conduct.'),
  areasForImprovement: z.array(z.string()).describe('List 2-3 specific, actionable areas where the agent can improve based on the call, especially concerning their product handling, communication, or responses to user sentiment.'),
  redFlags: z.array(z.string()).optional().describe("An array of critical flaws or 'red flags' observed during the call. This is for major issues like providing incorrect information, being unprofessional, or completely failing to address a key customer concern. If no major flaws are found, this can be omitted or be an empty array."),
  quantitativeAnalysis: QuantitativeAnalysisSchema.describe("Analysis of quantitative aspects of the call. All fields in this section MUST be filled out with an analysis or estimate; do not use 'N/A'."),
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
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    let transcriptResult: TranscriptionOutput;

    // Step 1: Obtain the transcript.
    // Use transcriptOverride ONLY if it is a valid, non-empty string. Otherwise, transcribe the audio.
    if (input.transcriptOverride && input.transcriptOverride.trim().length > 10) {
      transcriptResult = {
        diarizedTranscript: input.transcriptOverride,
        accuracyAssessment: "Provided as Text"
      };
    } else {
        if (!input.audioDataUri) {
             return {
              transcript: "[Transcription Error: No audio data URI or valid transcript override was provided.]",
              transcriptAccuracy: "Error",
              overallScore: 0,
              callCategorisation: "Error",
              metricScores: [{ metric: "Input", score: 1, feedback: `Call scoring aborted. Input was missing.` }],
              summary: "Call scoring aborted. Input was missing.",
              strengths: [],
              areasForImprovement: ["Ensure an audio file is uploaded or a valid transcript is provided."],
              redFlags: ["Critical input error: No audio or transcript provided."],
              quantitativeAnalysis: { talkToListenRatio: 'N/A', longestMonologue: 'N/A', silenceAnalysis: 'N/A' }
            };
        }
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
          areasForImprovement: ["Verify the audio file is valid and not corrupted.", "Check the transcription service status."],
          redFlags: [`Transcription service failed: ${err.message}`],
          quantitativeAnalysis: { talkToListenRatio: 'N/A', longestMonologue: 'N/A', silenceAnalysis: 'N/A' }
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
          areasForImprovement: ["Review the audio file for clarity and length. If the issue persists, it may be a problem with the AI transcription model's ability to process this specific audio."],
          redFlags: [`Invalid transcript obtained: ${reason}`],
          quantitativeAnalysis: { talkToListenRatio: 'N/A', longestMonologue: 'N/A', silenceAnalysis: 'N/A' }
        };
    }

    // Step 3: Proceed with scoring, now guaranteed to have a valid transcript.
    try {
      const productContext = input.product && input.product !== "General"
        ? `The call is regarding the product '${input.product}'. The 'Product Knowledge' and 'Product Presentation' metrics MUST be evaluated based on how well the agent explains and represents this specific product.`
        : "The call is a general sales call. The 'Product Knowledge' and 'Product Presentation' metrics should be evaluated based on general sales principles and how well the agent presents whatever product or service is being discussed, without needing specific pre-loaded knowledge of 'ET' or 'TOI'.";

      const scoringPromptText = `You are an expert, aggressive, and thorough call quality analyst and sales leader. Your task is to perform a top-quality, detailed analysis of a sales call based on the provided transcript.
${productContext}
${input.agentName ? `The agent's name is ${input.agentName}.` : ''}

Transcript:
\`\`\`
${transcriptResult.diarizedTranscript}
\`\`\`

Based *strictly* on the transcript provided, you MUST perform a complete and robust analysis.

**Part 1: Qualitative Metrics Analysis**
Provide a score from 1 to 5 and detailed, specific feedback for each of the following key qualitative metrics. Your feedback must reference parts of the transcript if possible.

- **Opening & Rapport Building**: How well did the agent start the call and connect with the user?
- **Needs Discovery**: Did the agent ask insightful questions to deeply understand the user's needs, problems, and motivations?
- **Product Presentation**: How effectively was the product presented as a solution to the user's discovered needs?
- **Objection Handling**: How well were objections or hesitations addressed? Was the approach empathetic and effective?
- **Closing Effectiveness**: Was there a clear, confident attempt to close the sale or define concrete next steps?
- **Clarity & Communication**: How clear, professional, and persuasive was the agent's language?
- **Agent's Tone & Professionalism**: Based on word choice and phrasing, what was the agent's inferred tone (e.g., confident, hesitant, empathetic, rushed)? **You must provide a score and detailed feedback for this metric.**
- **User's Perceived Sentiment**: Based on the user's responses, what was their sentiment throughout the call (e.g., interested, annoyed, confused, engaged)? **You must provide a score and detailed feedback for this metric.**
- **Product Knowledge**: How well did the agent demonstrate deep knowledge of the product they were selling?
- **Filler Word Usage**: Analyze the agent's use of filler words (um, uh, like, etc.). Was it excessive and distracting?
- **Pacing and Speaking Rate**: Analyze the agent's speaking pace. Was it too fast, too slow, or just right for building rapport and conveying information effectively?

**Part 2: Quantitative Analysis**
From the transcript, perform a quantitative analysis. Provide estimates for the following. **You MUST provide a value or detailed observation for each field. "N/A" is NOT an acceptable response.**
- **talkToListenRatio**: Estimate the agent's talk-to-listen ratio (e.g., '60/40'). Base this on the frequency and length of agent vs. user turns. Provide a brief justification for your estimate.
- **longestMonologue**: Identify the agent's longest speaking turn without interruption and describe its length or impact.
- **silenceAnalysis**: Comment on the use of silence or "dead air". Was it effectively used for impact, or was it a sign of hesitation or technical issues? Provide a meaningful observation.

**Part 3: Overall Assessment**
After scoring the metrics, provide a final assessment:
- **overallScore**: A single score from 0-5 reflecting your complete analysis.
- **callCategorisation**: A category (e.g., 'Very Good', 'Average', 'Needs Improvement') that best reflects the overall performance.
- **summary**: A concise, insightful summary of the call's effectiveness and outcome.
- **strengths**: 2-3 specific, key positive aspects of the call.
- **areasForImprovement**: 2-3 specific, actionable areas where the agent can improve.
- **redFlags**: A list of any critical flaws or major issues observed (e.g., providing incorrect information, being unprofessional, major compliance breaches). If none, this can be an empty array.

Your output must be a single, valid JSON object that strictly conforms to the required schema. Be thorough and critical in your analysis.
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
        areasForImprovement: ["AI service for scoring might be unavailable or encountered an issue with the transcript. Check server logs."],
        redFlags: [`The scoring AI failed to execute. Error: ${error.message}`],
        quantitativeAnalysis: { talkToListenRatio: 'Failure to analyze', longestMonologue: 'Failure to analyze', silenceAnalysis: 'Failure to analyze' }
      };
    }
  }
);

export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  // Final check to prevent crashes if both inputs are somehow missing
  if ((!input.audioDataUri) && (!input.transcriptOverride || input.transcriptOverride.trim().length < 10)) {
    return {
      transcript: "[System Error: Invalid arguments passed to scoreCall. No audio or transcript provided.]",
      transcriptAccuracy: "Error",
      overallScore: 0,
      callCategorisation: "Error",
      metricScores: [{ metric: "Input Validation", score: 1, feedback: "Call scoring aborted at entry point due to missing input." }],
      summary: "Call scoring aborted. Input was missing.",
      strengths: [],
      areasForImprovement: ["Ensure the frontend provides either an audio file or a valid transcript."],
      redFlags: ["Critical input error at function entry: No audio or transcript provided."],
      quantitativeAnalysis: { talkToListenRatio: 'N/A', longestMonologue: 'N/A', silenceAnalysis: 'N/A' }
    };
  }

  try {
    return await scoreCallFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error caught in exported scoreCall function:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    const errorMessage = `A critical system error occurred in the scoring flow: ${error.message}.`;
    return {
      transcript: `[System Error during scoring process execution. The flow failed unexpectedly. Raw Error: ${error.message}]`,
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
      areasForImprovement: ["Contact support or check server logs for critical system errors related to 'scoreCallFlow' execution."],
      redFlags: [`Catastrophic system failure in flow execution: ${error.message}`],
      quantitativeAnalysis: { talkToListenRatio: 'System Error', longestMonologue: 'System Error', silenceAnalysis: 'System Error' }
    };
  }
}

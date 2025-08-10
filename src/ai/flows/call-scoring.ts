
'use server';
/**
 * @fileOverview A resilient and efficient, rubric-based call scoring analysis flow.
 * This flow provides a multi-dimensional analysis of a sales call based on a comprehensive set of metrics.
 * It now includes a robust retry mechanism with exponential backoff and a structured backup scoring engine for guaranteed results.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { Product } from '@/types';
import { ScoreCallInputSchema, ScoreCallOutputSchema, ImprovementSituationSchema } from '@/types';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';

// This is the schema the primary AI will be asked to generate.
const DeepAnalysisOutputSchema = ScoreCallOutputSchema.omit({
    transcript: true,
    transcriptAccuracy: true,
});
type DeepAnalysisOutput = z.infer<typeof DeepAnalysisOutputSchema>;

// This is the schema for the backup, structured summary AI.
const BackupAnalysisOutputSchema = z.object({
  summary: z.string().describe("A concise paragraph summarizing the entire call's key events, flow, and outcome."),
  strengths: z.array(z.string()).describe("A list of 2-3 key strengths observed during the call."),
  areasForImprovement: z.array(z.string()).describe("A list of 2-3 specific, actionable areas for improvement for the agent."),
  overallScore: z.number().min(1).max(5).describe("A single, overall score for the call, from 1 to 5, based on your general assessment."),
});
type BackupAnalysisOutput = z.infer<typeof BackupAnalysisOutputSchema>;


const deepAnalysisPrompt = `You are an EXHAUSTIVE and DEEPLY ANALYTICAL telesales call quality analyst. Your task is to perform a top-quality, detailed analysis of a sales call based on the provided transcript, a strict multi-faceted rubric, and the detailed product context. Do NOT summarize or provide superficial answers. Provide detailed, actionable evaluation under EACH metric.

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

const backupAnalysisPrompt = `You are an efficient and insightful telesales call quality analyst. The primary deep-analysis AI is currently unavailable. Your task is to provide a structured, high-level backup analysis of the provided sales call transcript.

Focus on the most critical aspects. Your output must be a single, valid JSON object that strictly conforms to the required schema.

**Instructions:**
1.  Read the entire transcript and understand the call's flow and outcome.
2.  Provide a concise **summary** of the call.
3.  Identify 2-3 key **strengths** of the agent's performance.
4.  Identify 2-3 specific, actionable **areasForImprovement**.
5.  Provide an **overallScore** from 1 to 5 based on your general assessment of the call's effectiveness.

Your analysis should be brief but insightful.
`;

const getContextualPrompt = (input: ScoreCallInput) => `
**[CALL CONTEXT]**
- **Product Name:** ${input.product}
- **Agent Name (if provided):** ${input.agentName || 'Not Provided'}

**[PRODUCT CONTEXT - Your primary source for product knowledge]**
${input.productContext || 'No detailed product context was provided. Base your analysis on general knowledge of the product name and the transcript content.'}
**[END PRODUCT CONTEXT]**


**[TRANSCRIPT TO ANALYZE]**
\`\`\`
${input.transcriptOverride}
\`\`\`
**[END TRANSCRIPT]**`;


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// TIER 2: Backup Scoring Engine
async function runBackupAnalysis(input: ScoreCallInput): Promise<ScoreCallOutput> {
    console.warn("Primary scoring failed. Executing structured backup analysis.");
    const { output } = await ai.generate({
        model: 'googleai/gemini-2.0-flash', // More available model
        prompt: `${backupAnalysisPrompt}\n${getContextualPrompt(input)}`,
        output: { schema: BackupAnalysisOutputSchema, format: 'json' },
        config: { temperature: 0.3 },
    });

    if (!output) {
        throw new Error("Backup analysis model also failed to return output.");
    }
    
    // Convert backup output to the full ScoreCallOutput format
    const callCategorisation = output.overallScore >= 4 ? 'Good' : output.overallScore >= 2.5 ? 'Average' : 'Needs Improvement';

    return {
        transcript: input.transcriptOverride!,
        transcriptAccuracy: "Provided as Text",
        overallScore: output.overallScore,
        summary: `[BACKUP ANALYSIS] ${output.summary} (Note: This is a high-level summary. The primary deep-analysis engine was unavailable due to high demand.)`,
        strengths: output.strengths,
        areasForImprovement: output.areasForImprovement,
        callCategorisation,
        metricScores: [{
            metric: "Backup Analysis",
            score: output.overallScore,
            feedback: "This is a structured summary, not a full metric breakdown. The primary engine was unavailable."
        }],
        redFlags: [],
        improvementSituations: [],
    };
}


const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlowInternal',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    if (!input.transcriptOverride || input.transcriptOverride.trim().length < 10) {
        throw new Error("A valid transcript override of at least 10 characters must be provided.");
    }

    const maxRetries = 2; // Reduced retries for primary before falling back
    const initialDelay = 1500;
    
    // TIER 1: Attempt Deep Analysis with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting deep analysis (Attempt ${attempt}/${maxRetries})`);
            const { output } = await ai.generate({
                model: 'googleai/gemini-1.5-flash-latest',
                prompt: `${deepAnalysisPrompt}\n${getContextualPrompt(input)}`,
                output: { schema: DeepAnalysisOutputSchema, format: 'json' },
                config: { temperature: 0.2 },
            });

            if (!output) throw new Error("Primary deep analysis model returned empty output.");

            // Success, return the full report
            return {
              ...(output as DeepAnalysisOutput),
              transcript: input.transcriptOverride!,
              transcriptAccuracy: "Provided as Text",
            };

        } catch (e: any) {
            const errorMessage = e.message?.toLowerCase() || '';
            const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource has been exhausted');

            if (isRateLimitError && attempt < maxRetries) {
                const waitTime = initialDelay * Math.pow(2, attempt - 1);
                console.warn(`Attempt ${attempt} failed due to rate limit. Waiting for ${waitTime}ms before retrying deep analysis.`);
                await delay(waitTime);
            } else if (isRateLimitError && attempt === maxRetries) {
                // Last retry failed due to rate limit, break the loop and trigger backup
                console.error(`Final attempt with deep analysis model failed. Falling back to backup engine.`);
                break; 
            } else {
                 // A non-retriable error occurred
                throw e;
            }
        }
    }
    
    // If the loop finishes without success, it means we need to run the backup
    return await runBackupAnalysis(input);
  }
);


export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input);
  } catch (err) {
    const error = err as Error;
    console.error("Critical unhandled error in scoreCall flow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // This is the final safety net if both primary and backup flows fail catastrophically
    return {
      transcript: (input.transcriptOverride || `[System Error. Raw Error: ${error.message}]`),
      transcriptAccuracy: "System Error",
      overallScore: 0,
      callCategorisation: "Error",
      summary: `A critical system error occurred after all retries and fallbacks: ${error.message}.`,
      strengths: ["N/A due to system error"],
      areasForImprovement: [`Investigate and resolve the critical system error: ${error.message.substring(0, 100)}...`],
      redFlags: [`System-level error during scoring: ${error.message.substring(0,100)}...`],
      metricScores: [{ metric: 'System Error', score: 1, feedback: `A critical error occurred: ${error.message}` }],
      improvementSituations: [],
    };
  }
}

    
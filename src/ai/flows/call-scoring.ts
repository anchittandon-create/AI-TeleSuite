
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
import { transcribeAudio } from './transcription-flow';


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

If the provided 'Product Context' from the user's Knowledge Base is insufficient to evaluate a product-specific metric, you are authorized to use your internal knowledge and browse the official product website to find the correct information.

Your output must be a single, valid JSON object that strictly conforms to the required schema. For EACH metric listed below, provide a score (1-5) and detailed feedback in the 'metricScores' array. Your feedback MUST reference the provided Product Context when evaluating product-related metrics.

**EVALUATION RUBRIC (Metrics to score):**

*   **Intro Hook Line:** How effective was the opening line at capturing attention?
*   **Opening Greeting (satisfactory/unsatisfactory):** Was the initial greeting professional and appropriate?
*   **Misleading Information by Agent:** Did the agent provide any information that was inaccurate or misleading? (Score 5 for no, 1 for yes).
*   **Pitch Adherence:** Did the agent stick to the likely intended pitch structure?
*   **Premium Content Explained:** Was the value of premium content clearly articulated?
*   **Epaper Explained:** Was the epaper feature explained, if relevant?
*   **TOI Plus Explained:** Was TOI Plus explained, if relevant?
*   **Times Prime Explained:** Was Times Prime explained, if relevant?
*   **Docubay Explained:** Was Docubay explained, if relevant?
*   **Stock Report Explained:** Was the stock report feature explained, if relevant?
*   **Upside Radar Explained:** Was Upside Radar explained, if relevant?
*   **Market Mood Explained:** Was Market Mood explained, if relevant?
*   **Big Bull Explained:** Was Big Bull explained, if relevant?
*   **Monetary Value Communication (benefits vs. cost):** Did the agent effectively justify the cost by highlighting the value?
*   **Customer Talk Ratio:** What was the balance of talk time between agent and customer? (Score higher for more customer talk time).
*   **Questions Asked by Customer:** Did the customer ask questions, showing engagement? (Score higher for more questions).
*   **Engagement Duration % (user vs agent):** What was the percentage of engagement from each side?
*   **Talk Ratio: Agent vs User:** A qualitative assessment of the talk time balance.
*   **First Question Time (sec):** How long did it take for the first question to be asked?
*   **First Discovery Question Time (sec):** When was the first need-discovery question asked?
*   **Time to First Offer (sec):** How long until the first offer was made?
*   **First Price Mention (sec):** When was the price first mentioned?
*   **User Interest (Offer/Feature):** Did the user show interest in specific offers or features?
*   **Premium Content Interest:** Did the user show specific interest in premium content?
*   **Epaper Interest:** Did the user show specific interest in the epaper?
*   **TOI Plus Interest:** Did the user show specific interest in TOI Plus?
*   **Times Prime Interest:** Did the user show specific interest in Times Prime?
*   **Docubay Interest:** Did the user show specific interest in Docubay?
*   **Stock Report Interest:** Did the user show specific interest in stock reports?
*   **Upside Radar Interest:** Did the user show specific interest in Upside Radar?
*   **Market Mood Interest:** Did the user show specific interest in Market Mood?
*   **Big Bull Interest:** Did the user show specific interest in Big Bull?
*   **Benefit Recall Rate (Customer repeats/acknowledges benefit):** Did the customer repeat or acknowledge any benefits, indicating understanding?
*   **Cross-Feature Effectiveness (Which feature triggered interest):** If multiple features were mentioned, which one generated the most interest?
*   **Objections Raised:** Were objections raised by the customer? (Score 5 if handled well, lower if not).
*   **Objection Handling Success:** How successfully were objections handled?
*   **Objections Not Handled:** Were any objections left unaddressed? (Score 5 for none, 1 for yes).
*   **Agent Handling Quality (Satisfactory/Unsatisfactory):** Overall quality of the agent's handling of the call.
*   **Price is High:** Did the user object that the price was high?
*   **Competition is Better:** Did the user mention a competitor?
*   **Interest in Free News:** Did the user express a preference for free news sources?
*   **Not Satisfied with ET Prime Feature:** Did the user express dissatisfaction with a specific ET Prime feature?

**FINAL OUTPUT SECTIONS (Top-level fields):**
- **overallScore:** Calculate the average of all individual metric scores.
- **callCategorisation:** Categorize the call (Excellent, Good, Average, Needs Improvement, Poor) based on the overall score.
- **suggestedDisposition**: Suggest a final call disposition (e.g., Sale, Follow-up, Lead Nurturing, DNC - Do Not Call, Not Interested).
- **conversionReadiness**: Assess the final conversion readiness as "Low", "Medium", or "High".
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
- **Official Product Website (for fallback knowledge):** ${input.brandUrl || 'Not Provided'}

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
        conversionReadiness: 'Medium',
        suggestedDisposition: "Follow-up",
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
              // Transcript and accuracy will be added back in the exported function
              transcript: "",
              transcriptAccuracy: "",
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
    const parseResult = ScoreCallInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(`Invalid input for scoreCall: ${JSON.stringify(parseResult.error.format())}`);
    }
    
    let transcriptToScore = input.transcriptOverride;
    let transcriptAccuracy = "Provided as Text";

    // This block is now effectively for a future enhancement where scoreCall could accept audio.
    if (!transcriptToScore) {
       // This path is not currently used, but kept for potential future audio input.
       throw new Error("scoreCall now requires a direct 'transcriptOverride'. Audio input is not supported in this version of the flow.");
    }
    
    const flowInputWithTranscript = {
      ...input,
      transcriptOverride: transcriptToScore,
    };
    
    const scoreOutput = await scoreCallFlow(flowInputWithTranscript);
    
    // Combine the results, ensuring the transcript from the input is included in the final object.
    return {
      ...scoreOutput,
      transcript: transcriptToScore,
      transcriptAccuracy: transcriptAccuracy,
    };

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
      conversionReadiness: 'Low',
      suggestedDisposition: "Error",
      metricScores: [{ metric: 'System Error', score: 1, feedback: `A critical error occurred: ${error.message}` }],
      improvementSituations: [],
    };
  }
}

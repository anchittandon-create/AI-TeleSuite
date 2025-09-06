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


const deepAnalysisPrompt = `You are a world-class telesales performance coach and revenue optimization expert. Your primary goal is to analyze the provided call transcript to identify specific, actionable insights that will directly lead to increased sales, higher subscription conversion rates, and more revenue.

Your secondary goal is to provide an exhaustive, deeply analytical quality assessment against a detailed, multi-category rubric.

**Primary Directive:** For every piece of feedback, you MUST explain *how* the suggested change will improve the sales outcome. Be specific and strategic.

**Knowledge Sourcing:** If the provided 'Product Context' from the user's Knowledge Base is insufficient to evaluate a product-specific metric, you are authorized to use your internal knowledge and browse the official product website to find the correct information.

Your output must be a single, valid JSON object that strictly conforms to the required schema.

---
**EVALUATION RUBRIC & REVENUE-FOCUSED ANALYSIS (Metrics to score):**
---

For EACH metric below, provide a score (1-5) and detailed feedback. The feedback must explain the commercial impact of the agent's performance.

**CATEGORY 1: Call Opening & Rapport (The First 30 Seconds)**
*   **Opening Effectiveness:** Did the agent's opening line capture attention and establish credibility? Was it generic or tailored?
*   **Rapport Building:** Did the agent make a genuine attempt to build rapport, or did they jump straight into the pitch? How did this impact user engagement?
*   **Clarity of Purpose:** Did the agent clearly and concisely state the reason for the call? Did this create intrigue or defensiveness?

**CATEGORY 2: Needs Discovery & Qualification (SPIN/BANT Hybrid)**
*   **Situation Questions:** Did the agent effectively understand the customer's current situation?
*   **Problem Identification:** Did the agent successfully uncover or highlight a problem that the product can solve?
*   **Implication/Impact Questions:** Did the agent make the customer feel the pain of their problem (e.g., "What happens if you can't get this analysis done on time?")?
*   **Need-Payoff (Value Proposition):** Did the agent connect the product's benefits directly to solving the customer's stated problem?
*   **Budget & Authority:** Did the agent subtly qualify if the user has the authority and financial capacity to purchase?

**CATEGORY 3: Product Presentation & Value Communication**
*   **Feature-to-Benefit Translation:** Did the agent sell benefits (e.g., "save 2 hours a day") or just list features (e.g., "it has a dashboard")?
*   **Value Justification (ROI):** Did the agent effectively communicate the value proposition to justify the price? Was there a clear return on investment communicated?
*   **Premium Content/Tier Value:** Was the unique value of the premium subscription clearly articulated versus free alternatives?
*   **Cross-Sell/Up-sell Opportunity:** Did the agent identify and act on any opportunities to cross-sell or up-sell related products or higher tiers (e.g., Times Prime, TOI Plus, Epaper)?

**CATEGORY 4: Engagement & Control**
*   **Talk-Listen Ratio:** Analyze the balance. An ideal ratio is often the agent speaking 40-50% of the time. High agent talk time often correlates with lower sales.
*   **Pacing & Pauses:** Did the agent use strategic pauses to allow the customer to speak and think, or did they rush?
*   **Questioning Skills:** Did the agent use a mix of open-ended and closed-ended questions to guide the conversation effectively?
*   **Call Control:** Did the agent maintain control of the conversation, guiding it towards a sales outcome?

**CATEGORY 5: Objection Handling**
*   **Objection Recognition:** Did the agent recognize and welcome objections as opportunities to engage?
*   **Empathize, Clarify, Isolate, Respond (ECIR):** Assess the agent's technique. Did they show empathy, understand the real issue, confirm it was the main blocker, and then respond with a relevant benefit?
*   **Price Objection Handling:** Was the price objection handled by reinforcing value or by immediately offering a discount?
*   **Competition Mention Handling:** How did the agent respond when a competitor was mentioned? Did they reposition their product's unique value?

**CATEGORY 6: Closing**
*   **Trial Closes:** Did the agent use trial closes (e.g., "If we could handle that for you, would you be interested?") to gauge interest?
*   **Final Call to Action (CTA):** Was the closing CTA clear, confident, and specific? Did it create a sense of urgency?
*   **Handling "I need to think about it":** Did the agent have an effective response to this common stall?

---
**FINAL OUTPUT SECTIONS (Top-level fields):**
---
- **overallScore:** Calculate the average of all individual metric scores.
- **callCategorisation:** Categorize the call (Excellent, Good, Average, Needs Improvement, Poor) based on the overall score.
- **suggestedDisposition**: Suggest a final call disposition (e.g., Sale, Follow-up, Lead Nurturing, DNC - Do Not Call, Not Interested).
- **conversionReadiness**: Assess the final conversion readiness as "Low", "Medium", or "High".
- **summary:** Provide a concise paragraph summarizing the call's key events and outcome, with a focus on the sales opportunity.
- **strengths:** List the top 2-3 key strengths of the agent's performance **that positively impacted the sales outcome.**
- **areasForImprovement:** List the top 2-3 specific, actionable areas for improvement. **For each point, explain what the agent should do differently and why it will increase revenue.**
- **redFlags:** List any critical issues like compliance breaches, major mis-selling, or extremely poor customer service. If none, this should be an empty array.
- **metricScores:** An array containing an object for EACH metric from the rubric above, with 'metric', 'score', and 'feedback'.
- **improvementSituations**: Identify 2-4 specific moments in the call where the agent's response could have been significantly better. For each situation, you MUST provide:
    - **timeInCall**: The timestamp from the transcript for this moment (e.g., "[45 seconds - 58 seconds]").
    - **context**: A brief summary of the conversation topic at that moment.
    - **userDialogue**: The specific line of dialogue from the 'USER:' that the agent was responding to.
    - **agentResponse**: The agent's actual response in that situation.
    - **suggestedResponse**: The more suitable, improved response the agent could have used to move the sale forward.

Your analysis must be exhaustive for every single point. No shortcuts.
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

const backupAnalysisPrompt = `You are a structured summary telesales analyst. Your job is to provide a high-level summary and score for the provided call transcript.

**[CALL CONTEXT]**
- **Product Name:** {{product}}
- **Agent Name (if provided):** {{agentName}}

**[TRANSCRIPT TO ANALYZE]**
\`\`\`
{{{transcriptOverride}}}
\`\`\`
**[END TRANSCRIPT]**

**Your Task:**
Based on the transcript, provide a concise, structured summary. Your output must be a single, valid JSON object that strictly conforms to the required schema.

**Key instructions for your output:**
1.  **summary**: A concise paragraph summarizing the entire call's key events, flow, and outcome.
2.  **strengths**: List 2-3 key strengths observed during the call.
3.  **areasForImprovement**: List 2-3 specific, actionable areas for improvement for the agent.
4.  **overallScore**: Provide a single, overall score for the call, from 1 to 5, based on your general assessment.
`;


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const MAX_TRANSCRIPT_LENGTH_FOR_SCORING = 30000; // Approx 30k characters

function truncateTranscript(transcript: string): string {
    if (transcript.length <= MAX_TRANSCRIPT_LENGTH_FOR_SCORING) {
        return transcript;
    }
    const start = transcript.substring(0, MAX_TRANSCRIPT_LENGTH_FOR_SCORING * 0.5);
    const end = transcript.substring(transcript.length - (MAX_TRANSCRIPT_LENGTH_FOR_SCORING * 0.5));
    return `${start}\n\n... (transcript truncated due to length) ...\n\n${end}`;
}

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
    
    const truncatedTranscript = truncateTranscript(input.transcriptOverride);
    const inputWithTruncatedTranscript = { ...input, transcriptOverride: truncatedTranscript };


    const maxRetries = 2; // Reduced retries for primary before falling back
    const initialDelay = 1500;
    
    // TIER 1: Attempt Deep Analysis with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting deep analysis (Attempt ${attempt}/${maxRetries})`);
            const { output } = await ai.generate({
                model: 'googleai/gemini-1.5-flash-latest',
                prompt: `${deepAnalysisPrompt}\n${getContextualPrompt(inputWithTruncatedTranscript)}`,
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
    return await runBackupAnalysis(inputWithTruncatedTranscript);
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

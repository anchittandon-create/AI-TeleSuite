
'use server';
/**
 * @fileOverview A resilient and efficient, rubric-based call scoring analysis flow.
 * This flow provides a multi-dimensional analysis of a sales call based on a comprehensive set of metrics.
 * It now analyzes both the full audio for tonality and the full transcript for content, with a robust retry mechanism
 * and a text-only fallback for very large or problematic audio files.
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

// This is the schema for the text-only fallback model. It's simpler.
const TextOnlyFallbackOutputSchema = DeepAnalysisOutputSchema.omit(['improvementSituations']);
type TextOnlyFallbackOutput = z.infer<typeof TextOnlyFallbackOutputSchema>;


const deepAnalysisPrompt = `You are a world-class telesales performance coach and revenue optimization expert. Your primary goal is to analyze the provided call by listening to the audio for **tonality, pacing, and sentiment**, while reading the transcript for **content and structure**. You must identify specific, actionable insights that will directly lead to increased sales, higher subscription conversion rates, and more revenue.

Your secondary goal is to provide an exhaustive, deeply analytical quality assessment against a detailed, multi-category rubric.

**Primary Directive:** For every piece of feedback, you MUST explain *how* the suggested change will improve the sales outcome. Be specific and strategic. Your analysis must consider both the words spoken (from the transcript) and the way they were spoken (from the audio).

**Knowledge Sourcing:** If the provided 'Product Context' from the user's Knowledge Base is insufficient to evaluate a product-specific metric, you are authorized to use your internal knowledge and browse the official product website to find the correct information.

Your output must be a single, valid JSON object that strictly conforms to the required schema.

---
**EVALUATION RUBRIC & REVENUE-FOCUSED ANALYSIS (Metrics to score):**
---

For EACH metric below, provide a score (1-5) and detailed feedback. The feedback must explain the commercial impact of the agent's performance, considering both audio and text.

**CATEGORY 1: Call Opening & Rapport (The First 30 Seconds)**
*   **Opening Effectiveness & Tone:** Analyze the agent's tone in the audio. Was it confident, energetic, and engaging? Did the opening line capture attention?
*   **Rapport Building:** Did the agent's voice sound genuine and empathetic? How did this impact user engagement?
*   **Clarity and Pacing:** Was the agent's speech clear and well-paced, or rushed and mumbled?

**CATEGORY 2: Needs Discovery & Qualification (SPIN/BANT Hybrid)**
*   **Situation Questions:** Did the agent effectively understand the customer's current situation?
*   **Problem Identification:** Did the agent successfully uncover or highlight a problem that the product can solve?
*   **Implication/Impact Questions:** Did the agent make the customer feel the pain of their problem (e.g., "What happens if you can't get this analysis done on time?")?
*   **Need-Payoff (Value Proposition):** Did the agent connect the product's benefits directly to solving the customer's stated problem?
*   **Budget & Authority:** Did the agent subtly qualify if the user has the authority and financial capacity to purchase?

**CATEGORY 3: Product Presentation & Value Communication**
*   **Feature-to-Benefit Translation:** Did the agent sell benefits (e.g., "save 2 hours a day") or just list features (e.g., "it has a dashboard")?
*   **Value Justification (ROI):** Did the agent effectively communicate the value proposition to justify the price? Was there a clear return on investment communicated?
*   **Conviction & Enthusiasm:** Analyze the agent's tone during the presentation. Did they sound convinced and enthusiastic about the product's value?
*   **Cross-Sell/Up-sell Opportunity:** Did the agent identify and act on any opportunities to cross-sell or up-sell related products or higher tiers?

**CATEGORY 4: Engagement & Control**
*   **Talk-Listen Ratio & Pacing:** Analyze the audio for the balance of speech. An ideal ratio is often the agent speaking 40-50% of the time. Did the agent use strategic pauses to allow the customer to think?
*   **Questioning Skills:** Did the agent use a mix of open-ended and closed-ended questions to guide the conversation effectively?
*   **Call Control & Confidence:** Did the agent's tone project confidence and control over the conversation's direction?

**CATEGORY 5: Objection Handling**
*   **Objection Recognition & Tone:** How did the agent's tone shift when faced with an objection? Did they remain calm and confident?
*   **Empathize, Clarify, Isolate, Respond (ECIR):** Assess the agent's technique. Did they show empathy, understand the real issue, confirm it was the main blocker, and then respond with a relevant benefit?
*   **Price Objection Handling:** Was the price objection handled by reinforcing value or by immediately offering a discount?
*   **Competition Mention Handling:** How did the agent respond when a competitor was mentioned?

**CATEGORY 6: Closing**
*   **Trial Closes:** Did the agent use trial closes (e.g., "If we could handle that for you, would you be interested?") to gauge interest?
*   **Final Call to Action (CTA):** Was the closing CTA clear, confident, and specific? Did the agent's tone create a sense of urgency or convey weakness?
*   **Handling "I need to think about it":** Did the agent have an effective response to this common stall?

---
**FINAL OUTPUT SECTIONS (Top-level fields):**
---
- **overallScore:** Calculate the average of all individual metric scores.
- **callCategorisation:** Categorize the call (Excellent, Good, Average, Needs Improvement, Poor) based on the overall score.
- **suggestedDisposition**: Suggest a final call disposition.
- **conversionReadiness**: Assess the final conversion readiness as "Low", "Medium", or "High".
- **summary:** Provide a concise paragraph summarizing the call, including insights on tonality and sentiment.
- **strengths:** List the top 2-3 key strengths, including points on vocal delivery.
- **areasForImprovement:** List the top 2-3 specific, actionable areas for improvement, including vocal coaching tips.
- **redFlags:** List any critical issues like compliance breaches, major mis-selling, or extremely poor customer service.
- **metricScores:** An array containing an object for EACH metric from the rubric above, with 'metric', 'score', and 'feedback'.
- **improvementSituations**: Identify 2-4 specific moments in the call. For each situation, provide:
    - **timeInCall**: The timestamp from the transcript (e.g., "[45 seconds - 58 seconds]").
    - **context**: A brief summary of the conversation topic.
    - **userDialogue**: The specific line of dialogue from the 'USER:'.
    - **agentResponse**: The agent's actual response.
    - **suggestedResponse**: The more suitable, improved response.

Your analysis must be exhaustive for every single point. No shortcuts.
`;

const textOnlyFallbackPrompt = `You are a world-class telesales performance coach. Analyze the provided call transcript for **content and structure**. You cannot analyze audio tone. Your output must be a valid JSON object.

**EVALUATION RUBRIC:**
Based *only* on the text, provide a score (1-5) and feedback for each metric.

- **Opening & Rapport:** How effective was the opening line? Did the agent build rapport textually?
- **Needs Discovery:** Did the agent ask good questions to understand the user's situation and problems?
- **Product Presentation:** How well was the product's value communicated in text?
- **Objection Handling:** How were objections handled based on the dialogue?
- **Closing:** Was the closing statement clear and effective?

**FINAL OUTPUT SECTIONS:**
- **overallScore:** Average of all metric scores.
- **callCategorisation:** Categorize the call based on the score.
- **suggestedDisposition**: Suggest a final call disposition.
- **conversionReadiness**: Assess conversion readiness.
- **summary:** A concise paragraph summarizing the call's content.
- **strengths:** Top 2-3 strengths observed from the text.
- **areasForImprovement:** Top 2-3 areas for improvement based on the text.
- **redFlags:** Any critical issues evident from the text alone.
- **metricScores:** An array of objects for EACH metric above with 'metric', 'score', and 'feedback'.

Your analysis is based only on the transcript. State this limitation in your summary.`;


const getContextualPrompt = (input: ScoreCallInput, transcript: string, isTextOnly: boolean = false) => `
**[CALL CONTEXT]**
- **Product Name:** ${input.product}
- **Agent Name (if provided):** ${input.agentName || 'Not Provided'}
- **Official Product Website (for fallback knowledge):** ${input.brandUrl || 'Not Provided'}

**[PRODUCT CONTEXT - Your primary source for product knowledge]**
${input.productContext || 'No detailed product context was provided. Base your analysis on general knowledge of the product name and the transcript content.'}
**[END PRODUCT CONTEXT]**


**[TRANSCRIPT TO ANALYZE]**
\`\`\`
${transcript}
\`\`\`
**[END TRANSCRIPT]**

${!isTextOnly && input.audioDataUri ? `
**[AUDIO DATA]**
The audio for this call is provided as a separate input. You must analyze it for tone, sentiment, and pacing.` : `
**[ANALYSIS MODE]**
You are in text-only analysis mode. Do not attempt to analyze audio tonality. Base your entire report on the transcript content.`
}`;


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlowInternal',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    let transcriptToScore: string;
    let transcriptAccuracy: string;
    
    // Step 1: Get the transcript. Client should preferably provide it.
    if (input.transcriptOverride) {
        transcriptToScore = input.transcriptOverride;
        transcriptAccuracy = "Provided as Text";
    } else if (input.audioDataUri) {
        // This is a fallback if client fails to transcribe first.
        console.warn("scoreCallFlow: audioDataUri provided without transcriptOverride. Transcribing internally as a fallback.");
        const transcriptionResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
        if (transcriptionResult.accuracyAssessment === "Error" || transcriptionResult.diarizedTranscript.includes("[Transcription Error")) {
            throw new Error(`Internal transcription fallback failed: ${transcriptionResult.diarizedTranscript}`);
        }
        transcriptToScore = transcriptionResult.diarizedTranscript;
        transcriptAccuracy = transcriptionResult.accuracyAssessment;
    } else {
        throw new Error("Either audioDataUri or transcriptOverride must be provided to score a call.");
    }
    
    // Step 2: Perform the deep analysis using audio and text, if audio is available.
    if (input.audioDataUri) {
        const maxRetries = 2;
        const initialDelay = 1500;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempting deep analysis with audio and text (Attempt ${attempt}/${maxRetries})`);
                const { output } = await ai.generate({
                    model: 'googleai/gemini-1.5-flash-latest',
                    prompt: [
                      { text: deepAnalysisPrompt },
                      { media: { url: input.audioDataUri } },
                      { text: getContextualPrompt(input, transcriptToScore) }
                    ],
                    output: { schema: DeepAnalysisOutputSchema, format: 'json' },
                    config: { temperature: 0.2 },
                });

                if (!output) throw new Error("Primary deep analysis model returned empty output.");

                // Success with deep analysis
                return {
                  ...(output as DeepAnalysisOutput),
                  transcript: transcriptToScore,
                  transcriptAccuracy: transcriptAccuracy,
                };

            } catch (e: any) {
                const errorMessage = e.message?.toLowerCase() || '';
                console.warn(`Attempt ${attempt} of deep analysis failed. Reason: ${errorMessage}`);
                const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('resource has been exhausted');

                if (isRateLimitError && attempt < maxRetries) {
                    const waitTime = initialDelay * Math.pow(2, attempt - 1);
                    console.warn(`Waiting for ${waitTime}ms before retrying.`);
                    await delay(waitTime);
                } else if (attempt === maxRetries) {
                    console.error("Deep analysis failed after all retries. Proceeding with text-only fallback.");
                    break; 
                }
            }
        }
    }
    
    // Step 3: Text-only fallback if audio analysis was skipped or failed.
    try {
        console.log("Executing text-only fallback scoring.");
        const { output } = await ai.generate({
            model: 'googleai/gemini-2.0-flash', 
            prompt: [
              { text: textOnlyFallbackPrompt },
              { text: getContextualPrompt(input, transcriptToScore, true) }
            ],
            output: { schema: TextOnlyFallbackOutputSchema, format: 'json' },
            config: { temperature: 0.25 },
        });

        if (!output) throw new Error("Text-only fallback model also returned empty output.");

        const fallbackSummary = `${output.summary} (Note: This analysis is based on the transcript only, as full audio analysis was either skipped or failed.)`;

        return {
          ...(output as TextOnlyFallbackOutput),
          improvementSituations: [], 
          summary: fallbackSummary,
          transcript: transcriptToScore,
          transcriptAccuracy: transcriptAccuracy,
        };
    } catch (fallbackError: any) {
        console.error("Catastrophic failure: Text-only fallback also failed.", fallbackError);
        throw fallbackError;
    }
  }
);


export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    const parseResult = ScoreCallInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(`Invalid input for scoreCall: ${JSON.stringify(parseResult.error.format())}`);
    }
    
    return await scoreCallFlow(input);

  } catch (err) {
    const error = err as Error;
    console.error("Critical unhandled error in scoreCall flow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // This is the guaranteed fallback response for any catastrophic error.
    return {
      transcript: (input.transcriptOverride || `[System Error. Raw Error: ${error.message}]`),
      transcriptAccuracy: "System Error",
      overallScore: 0,
      callCategorisation: "Error",
      summary: `A critical system error occurred during scoring: ${error.message}. This can happen if the AI models are temporarily unavailable or if the provided file is incompatible after multiple attempts.`,
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

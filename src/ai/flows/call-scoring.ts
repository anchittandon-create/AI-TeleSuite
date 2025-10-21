
/**
 * @fileOverview A resilient and efficient, rubric-based call scoring analysis flow.
 * This flow now expects a pre-generated transcript and focuses solely on scoring
 * by analyzing both the audio for tonality and the transcript for content.
 * It uses a robust retry mechanism for the scoring model.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { Product } from '@/types';
import { ScoreCallInputSchema, ScoreCallOutputSchema } from '@/types';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';
import { resolveGeminiAudioReference } from '@/ai/utils/media';
import { AI_MODELS } from '@/ai/config/models';

// The input schema now requires a transcript, simplifying the flow's responsibility.
// No longer extending, as the base schema is now sufficient since transcription is separate.
const InternalScoreCallInputSchema = ScoreCallInputSchema;
type InternalScoreCallInput = z.infer<typeof InternalScoreCallInputSchema>;

// Local definition to avoid circular dependencies
const ImprovementSituationSchema = z.object({
  timeInCall: z.string().optional().describe("The timestamp or time range from the transcript when this situation occurred (e.g., '[1 minute 5 seconds - 1 minute 20 seconds]')."),
  context: z.string().describe("A brief summary of the conversation topic at the moment of the identified improvement opportunity."),
  userDialogue: z.string().optional().describe("The specific dialogue from the 'USER:' that immediately preceded the agent's suboptimal response."),
  agentResponse: z.string().describe("The agent's actual response in that situation."),
  suggestedResponse: z.string().describe("The more suitable, improved response the agent could have used."),
});

// This is the schema the primary AI will be asked to generate.
const DeepAnalysisOutputSchema = ScoreCallOutputSchema.omit({
    transcript: true,
    transcriptAccuracy: true,
    // This is now locally defined
}).extend({
    improvementSituations: z.array(ImprovementSituationSchema).optional().describe("An array of specific situations where the agent could have responded better."),
});
type DeepAnalysisOutput = z.infer<typeof DeepAnalysisOutputSchema>;

// This is the schema for the text-only fallback model. It's simpler.
const TextOnlyFallbackOutputSchema = DeepAnalysisOutputSchema.omit(['improvementSituations']);
type TextOnlyFallbackOutput = z.infer<typeof TextOnlyFallbackOutputSchema>;


const deepAnalysisPrompt = `You are a world-class, exceptionally detailed telesales performance coach and revenue optimization expert. Your primary goal is to provide an exhaustive, deeply analytical quality assessment against a detailed, multi-category rubric containing over 75 distinct metrics. You will analyze the provided call by listening to the audio for **tonality, pacing, and sentiment**, while reading the transcript for **content, strategy, and adherence to process**. You must identify specific, actionable insights that will directly lead to increased sales and higher subscription conversion rates.

**Primary Directive:** You MUST provide a score and detailed feedback for EVERY SINGLE metric listed in the rubric below. No metric should be skipped. For every piece of feedback, you MUST explain *how* the suggested change will improve the sales outcome. Be specific and strategic. Your analysis must be grounded in both the audio and the text content.

**Knowledge Sourcing:** If the provided 'Product Context' from the user's Knowledge Base is insufficient to evaluate a product-specific metric, you are authorized to use your internal knowledge and browse the official product website to find the correct information.

Your output must be a single, valid JSON object that strictly conforms to the required schema.

---
**EVALUATION RUBRIC & REVENUE-FOCUSED ANALYSIS (You MUST score all 75+ metrics):**
---

For EACH metric below, provide a score (1-5) and detailed feedback in the \`metricScores\` array. The feedback must explain the commercial impact of the agent's performance, considering both audio and text.

**CATEGORY 1: Introduction & Rapport Building (First 30 Seconds)**
1.  **Introduction Quality:** Overall effectiveness of the opening.
2.  **Intro Hook Line:** Was the opening line attention-grabbing and relevant?
3.  **Opening Greeting (Tone & Words):** Analyze tone and word choice. Was it confident, energetic, and engaging?
4.  **Purpose of Call Statement:** Was the reason for the call stated clearly and compellingly?
5.  **Rapport Building (Initial):** Did the agent's voice sound genuine and empathetic?
6.  **Energy and Enthusiasm (Opening):** Did the agent sound motivated and positive?
7.  **Clarity & Pacing (Opening):** Was the agent's initial speech clear and well-paced, or rushed/mumbled?

**CATEGORY 2: Pitch & Product Communication**
8.  **Pitch Adherence:** Did the agent follow the core structure of the expected pitch?
9.  **Feature-to-Benefit Translation:** Did the agent sell benefits (e.g., "save 2 hours a day") or just list features (e.g., "it has a dashboard")?
10. **Value Justification (ROI):** Did the agent effectively communicate the value to justify the price? Was there a clear return on investment communicated?
11. **Monetary Value Communication (Benefits vs. Cost):** Was the agent able to effectively articulate the monetary value and justify the cost?
12. **Clarity of Product Explanation:** Was the explanation of the product simple and easy to understand?
13. **Premium Content Explained:** Was the value of premium content clearly articulated?
14. **Epaper Explained:** If applicable, was the Epaper feature explained well?
15. **TOI Plus Explained:** If applicable, was the TOI Plus value proposition clear?
16. **Times Prime Explained:** If applicable, was the Times Prime value proposition clear?
17. **Docubay Explained:** If applicable, was Docubay explained correctly?
18. **Stock Report Explained:** If applicable, was the Stock Report feature explained?
19. **Upside Radar Explained:** If applicable, was the Upside Radar feature explained?
20. **Market Mood Explained:** If applicable, was the Market Mood feature explained?
21. **Big Bull Explained:** If applicable, was the Big Bull feature explained?
22. **Cross-Sell/Up-sell Opportunity:** Did the agent identify and act on any opportunities to cross-sell or up-sell?

**CATEGORY 3: Customer Engagement & Control**
23. **Talk-Listen Ratio:** Analyze the audio for the balance of speech. Ideal is often agent speaking 40-50%.
24. **Talk Ratio (Agent vs User):** Similar to above, assess the balance of dialogue.
25. **Engagement Duration % (User vs Agent):** What percentage of the engagement was driven by the user vs the agent?
26. **Active Listening Cues:** Did the agent use verbal cues ('I see', 'that makes sense') to show they were listening?
27. **Questioning Skills (Open vs Closed):** Did the agent use a mix of open-ended and closed-ended questions effectively?
28. **Questions Asked by Customer:** How many questions did the customer ask? Does this indicate engagement or confusion?
29. **User Interest (Offer/Feature):** Assess the user's level of interest when offers or features were mentioned.
30. **Premium Content Interest:** Did the user show specific interest in Premium Content?
31. **Epaper Interest:** Did the user show specific interest in Epaper?
32. **TOI Plus Interest:** Did the user show specific interest in TOI Plus?
33. **Times Prime Interest:** Did the user show specific interest in Times Prime?

**CATEGORY 4: Agent's Tonality & Soft Skills (Audio Analysis)**
34. **Conviction & Enthusiasm (Tone):** Did the agent sound convinced and enthusiastic about the product's value?
35. **Clarity & Articulation:** Was the agent's speech clear and easy to understand throughout the call?
36. **Pacing and Pauses:** Did the agent use strategic pauses, or did they speak too quickly or slowly?
37. **Agent's Tone (Overall):** Assess the overall tone - was it professional, friendly, aggressive, or passive?
38. **Empathy Demonstration (Tone):** Did the agent's tone convey genuine empathy when required?
39. **Confidence Level (Vocal):** Did the agent's voice project confidence?
40. **Friendliness & Politeness:** Was the agent polite and friendly in their language and tone?
41. **Active Listening (Vocal Cues):** Did the agent use vocal affirmations ('mm-hmm', 'I see') to signal they were listening?
42. **User's Perceived Sentiment (from Tone):** From the user's tone, gauge their level of interest, frustration, or engagement.

**CATEGORY 5: Needs Discovery & Qualification**
43. **Situation Questions:** Did the agent effectively understand the customer's current situation?
44. **Problem Identification & Probing:** Did the agent successfully uncover or highlight a problem the product solves?
45. **Implication/Impact Questions:** Did the agent make the customer feel the pain of their problem?
46. **Need-Payoff (Value Proposition):** Did the agent connect the product's benefits directly to solving the customer's stated problem?
47. **Budget & Authority Qualification:** Did the agent subtly qualify if the user has the authority and financial capacity to purchase?
48. **First Discovery Question Time (sec):** How long did it take to ask the first discovery question?
49. **First Question Time (sec):** How long did it take to ask the first question of any kind?

**CATEGORY 6: Sales Process & Hygiene**
50. **Misleading Information by Agent:** Did the agent provide any information that was factually incorrect or misleading?
51. **Call Control:** Did the agent maintain control of the conversation's direction?
52. **Time to First Offer (sec):** How long did it take for the agent to present the first offer?
53. **First Price Mention (sec):** How long into the call was price first mentioned?
54. **Compliance & Adherence:** Did the agent adhere to all required compliance scripts and procedures?
55. **Call Opening (Satisfactory/Unsatisfactory):** A binary judgment on the overall opening.
56. **Call Closing (Satisfactory/Unsatisfactory):** A binary judgment on the overall closing.
57. **Agent Professionalism:** Did the agent maintain a professional demeanor throughout?

**CATEGORY 7: Objection Handling & Closing**
58. **Objection Recognition & Tone:** How did the agent's tone shift when faced with an objection?
59. **Empathize, Clarify, Isolate, Respond (ECIR):** Assess the agent's technique. Did they show empathy, understand the real issue, confirm it was the main blocker, and then respond?
60. **Price Objection Response:** Was the price objection handled by reinforcing value or by immediately offering a discount?
61. **"I'm Not Interested" Handling:** How did the agent handle this classic stall?
62. **"Send Me Details" Handling:** How did the agent manage the request to just send details?
63. **Competition Mention Handling:** How did the agent respond when a competitor was mentioned?
64. **Handling "I need to think about it":** Did the agent have an effective response to this common stall?
65. **Trial Closes:** Did the agent use trial closes (e.g., "If we could handle that, would you be interested?") to gauge interest?
66. **Urgency Creation:** Did the agent effectively create a sense of urgency for the offer?
67. **Final Call to Action (CTA):** Was the closing CTA clear, confident, and specific?
68. **Next Steps Definition:** Were the next steps, if any, clearly defined?
69. **Closing Strength (Tone):** Did the agent's tone convey confidence or weakness during the close?
70. **Assumptive Close Attempt:** Did the agent attempt an assumptive close?
71. **Benefit-driven Close:** Was the close tied back to the customer's key needs/benefits?
72. **Handling Final Questions:** How were the customer's final questions before the close handled?
73. **Post-CTA Silence:** Did the agent use silence effectively after asking for the sale?
74. **Payment Process Explanation:** Was the payment process explained clearly and simply?
75. **Confirmation of Sale/Next Step:** Did the agent confirm the final outcome clearly?

---
**FINAL OUTPUT SECTIONS (Top-level fields):**
---
- **overallScore:** Calculate the average of all individual metric scores.
- **callCategorisation:** Categorize the call (Excellent, Good, Average, Needs Improvement, Poor) based on the overall score.
- **suggestedDisposition**: Suggest a final call disposition.
- **conversionReadiness**: Assess the final conversion readiness as "High", "Medium", or "Low".
- **summary:** Provide a concise paragraph summarizing the call, including insights on tonality and sentiment.
- **strengths:** List the top 2-3 key strengths, including points on vocal delivery.
- **areasForImprovement:** List the top 2-3 specific, actionable areas for improvement, including vocal coaching tips.
- **redFlags:** List any critical issues like compliance breaches, major mis-selling, or extremely poor customer service.
- **metricScores:** An array containing an object for EACH of the 75+ metrics from the rubric above, with 'metric', 'score', and 'feedback'.
- **improvementSituations**: Identify 2-4 specific moments in the call. For each situation, you MUST provide:
    - **timeInCall**: The timestamp from the transcript (e.g., "[45 seconds - 58 seconds]").
    - **context**: A brief summary of what was being discussed.
    - **userDialogue**: The specific line of dialogue from the 'USER:'.
    - **agentResponse**: The agent's actual response.
    - **suggestedResponse**: The more suitable, improved response that addresses the core issue.

Your analysis must be exhaustive for every single point. No shortcuts.
`;

const textOnlyFallbackPrompt = `You are a world-class telesales performance coach. Analyze the provided call transcript for **content and structure**. You cannot analyze audio tone. Your output must be a valid JSON object.

**EVALUATION RUBRIC (TEXT-ONLY MODE):**
Base *only* on the transcript, provide a score (1-5) and detailed feedback for each metric listed below so that the downstream UI still receives dialogue profiling insights.

- **Introduction Quality:** How effective was the opening?
- **Pitch Adherence:** Did the agent follow the expected script structure?
- **Needs Discovery:** Did the agent ask good questions to understand the user's situation?
- **Value Communication:** How well was the product's value communicated in text?
- **Objection Handling:** How were objections handled based on the dialogue?
- **Closing Effectiveness:** Was the closing statement clear and effective?
- **Talk-Listen Ratio:** Estimate the overall balance of speaking time between the agent and user based purely on the transcript volume.
- **Talk Ratio (Agent vs User):** Provide a numerical score representing whether the agent dominated the conversation or allowed user airtime.
- **Engagement Duration % (User vs Agent):** Infer engagement by tracking how frequently the user responds and provide a score.
- **Active Listening Cues:** Did the agent acknowledge or mirror the user's statements?
- **Questioning Skills (Open vs Closed):** Evaluate the mix and effectiveness of questions asked.

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


const getContextualPrompt = (input: InternalScoreCallInput, isTextOnly: boolean = false) => `
**[CALL CONTEXT]**
- **Product Name:** ${input.product}
- **Agent Name (if provided):** ${input.agentName || 'Not Provided'}
- **Official Product Website (for fallback knowledge):** ${input.brandUrl || 'Not Provided'}

**[PRODUCT CONTEXT - Your primary source for product knowledge]**
${input.productContext || 'No detailed product context was provided. Base your analysis on general knowledge of the product name and the transcript content.'}
**[END PRODUCT CONTEXT]**


**[DIARIZED TRANSCRIPT TO ANALYZE]**
The following is a transcript of the call with speaker labels (Agent (Name), User (Name), IVR, etc.) and precise time allotments. Use this as the basis for your content analysis.
\`\`\`
${input.transcriptOverride}
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
    inputSchema: InternalScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: InternalScoreCallInput): Promise<ScoreCallOutput> => {
    
    if (!input.transcriptOverride) {
        throw new Error("A transcript must be provided for scoring.");
    }
    
    // Step 1: Perform the deep analysis using audio and text.
    const maxRetries = 2;
    const initialDelay = 1500;
    const primaryModel = AI_MODELS.MULTIMODAL_PRIMARY;
    const fallbackAudioModel = AI_MODELS.MULTIMODAL_SECONDARY;
    const textOnlyModel = AI_MODELS.TEXT_ONLY;
    let audioMediaReference: { url: string; contentType?: string } | undefined = undefined;

    if (input.audioUrl) {
        audioMediaReference = { url: input.audioUrl };
    } else if (input.audioDataUri) {
        try {
            // We resolve the data URI to a Gemini-compatible reference.
            // Note: This path still has size limitations.
            const geminiRef = await resolveGeminiAudioReference(input.audioDataUri, {
                displayName: 'call-scoring-audio',
            });
            audioMediaReference = { url: geminiRef.url, contentType: geminiRef.contentType };
        } catch (prepError) {
            console.error("Failed to prepare audio from data URI for Gemini analysis. Falling back to text-only scoring.", prepError);
            audioMediaReference = undefined;
        }
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting deep analysis with audio and text (Attempt ${attempt}/${maxRetries})`);
            
            const promptParts: any[] = [
                { text: deepAnalysisPrompt },
                { text: getContextualPrompt(input) }
            ];

            // Only include audio data if it's available.
            if (audioMediaReference) {
                const mediaPart = audioMediaReference.contentType
                  ? { media: { url: audioMediaReference.url, contentType: audioMediaReference.contentType } }
                  : { media: { url: audioMediaReference.url } };
                promptParts.splice(1, 0, mediaPart);
            } else {
                console.log("No audio provided or prepared. Proceeding with text-only aspects of the deep analysis prompt.");
            }
            
            const modelToUse = attempt === 1 ? primaryModel : fallbackAudioModel;
            const { output } = await ai.generate({
                model: modelToUse,
                prompt: promptParts,
                output: { schema: DeepAnalysisOutputSchema, format: 'json' },
                config: { temperature: 0.2 },
            });

            if (!output) throw new Error("Primary deep analysis model returned empty output.");

            // Success with deep analysis - ensure transcript is passed through.
            return {
              ...(output as DeepAnalysisOutput),
              transcript: input.transcriptOverride,
              transcriptAccuracy: "N/A (pre-transcribed)", // Not assessed here
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
            } else if (!isRateLimitError) {
                // For non-quota errors (like model failures), break immediately to fallback.
                console.error("Deep analysis failed with non-retriable error. Proceeding with text-only fallback.");
                break;
            }
        }
    }
    
    // Step 2: Text-only fallback if audio analysis failed.
    try {
        console.log("Executing text-only fallback scoring.");
        const { output } = await ai.generate({
            model: textOnlyModel, 
            prompt: [
              { text: textOnlyFallbackPrompt },
              { text: getContextualPrompt(input, true) }
            ],
            output: { schema: TextOnlyFallbackOutputSchema, format: 'json' },
            config: { temperature: 0.25 },
        });

        if (!output) throw new Error("Text-only fallback model also returned empty output.");

        const fallbackSummary = `${output.summary} (Note: This analysis is based on the transcript only, as full audio analysis was either skipped or failed.)`;

        // Ensure transcript is passed through on fallback as well.
        return {
          ...(output as TextOnlyFallbackOutput),
          improvementSituations: [], 
          summary: fallbackSummary,
          transcript: input.transcriptOverride,
          transcriptAccuracy: "N/A (pre-transcribed)",
        };
    } catch (fallbackError: any) {
        console.error("Catastrophic failure: Text-only fallback also failed.", fallbackError);
        throw fallbackError;
    }
  }
);


export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    const parseResult = InternalScoreCallInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(`Invalid input for scoreCall: ${JSON.stringify(parseResult.error.format())}`);
    }
    
    return await scoreCallFlow(parseResult.data);

  } catch (err) {
    const error = err as Error;
    console.error("Critical unhandled error in scoreCall flow:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // This is the guaranteed fallback response for any catastrophic error.
    return {
      transcript: (input.transcriptOverride || `[System Error. Raw Error: ${error.message}]`),
      transcriptAccuracy: "System Error",
      overallScore: 0,
      callCategorisation: "Error",
      summary: `A critical system error occurred during scoring: ${error.message}. This can happen if the AI models are temporarily unavailable or if the provided transcript is incompatible after multiple attempts.`,
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

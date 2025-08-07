
'use server';
/**
 * @fileOverview An exhaustively detailed, rubric-based call scoring analysis flow.
 * This flow provides a multi-dimensional analysis of a sales call based on a comprehensive set of metrics.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
import { Product } from '@/types';
import { ScoreCallInputSchema, ScoreCallOutputSchema } from '@/types';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';


const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ScoreCallOutputSchema,
  },
  async (input: ScoreCallInput): Promise<ScoreCallOutput> => {
    let transcriptResult: TranscriptionOutput;

    // Step 1: Obtain the transcript.
    if (input.transcriptOverride && input.transcriptOverride.trim().length > 10) {
      transcriptResult = {
        diarizedTranscript: input.transcriptOverride,
        accuracyAssessment: "Provided as Text"
      };
    } else {
      if (!input.audioDataUri) {
        throw new Error("No audio data URI or valid transcript override was provided.");
      }
      transcriptResult = await transcribeAudio({ audioDataUri: input.audioDataUri });
    }

    // Step 2: Validate the transcription result before proceeding to scoring.
    if (!transcriptResult || typeof transcriptResult.diarizedTranscript !== 'string' || transcriptResult.diarizedTranscript.toLowerCase().includes("[error") || transcriptResult.accuracyAssessment === "Error") {
      throw new Error(`A valid transcript could not be obtained. Reason: ${transcriptResult?.diarizedTranscript?.toString() || 'Unknown transcription error'}`);
    }

    // Step 3: Proceed with scoring.
    const productContext = input.product && input.product !== "General"
      ? `The call is regarding the product '${input.product}'. All evaluations under 'Sales Pitch Quality' and 'Plan Explanation' MUST be in this context.`
      : "The call is a general sales call. Evaluations should be based on general sales principles for the product being discussed.";

    const scoringPromptText = `You are an EXHAUSTIVE, AGGRESSIVE, and DEEPLY ANALYTICAL telesales call quality analyst. Your task is to perform a top-quality, detailed analysis of a sales call based on the provided transcript and a strict, multi-faceted rubric. Do NOT summarize or provide superficial answers. Provide detailed, actionable evaluation under EACH metric.

**Call Context:**
- ${productContext}
- ${input.agentName ? `The agent's name is ${input.agentName}.` : ''}

**Transcript to Analyze:**
\`\`\`
${transcriptResult.diarizedTranscript}
\`\`\`

**Your Task:**
Analyze the transcript exhaustively and provide a score (1-5) and detailed feedback for EVERY SINGLE METRIC listed below. Your output must be a single, valid JSON object that strictly conforms to the required schema. If you cannot determine a metric from the transcript, you MUST make a reasonable estimation and note your assumption in the feedback. Do not use "N/A".

**EVALUATION RUBRIC:**

**1. STRUCTURE & FLOW:**
   - **Call Opening Effectiveness:** Was there a strong, immediate hook within the first 5 seconds?
   - **Greeting & Introduction Clarity:** Was the brand, agent name, and intent clearly established?
   - **Call Structuring:** Was the conversation flow logical — from introduction to discovery to pitch to closure?
   - **Segue Smoothness:** Were transitions between topics smooth and non-jarring?
   - **Time Management:** Was the call length optimal — neither rushed nor stretched?

**2. COMMUNICATION & DELIVERY:**
   - **Voice Tone Appropriateness:** Did tone match user persona (friendly, formal, analytical, urgent)? (Infer from text)
   - **Energy Level:** Was the energy consistent, enthusiastic, and confidence-building? (Infer from text)
   - **Pitch & Modulation:** Were changes in voice pitch used to emphasize key ideas? (Infer from text and punctuation)
   - **Clarity of Speech:** Were words spoken clearly, without mumbling or over-talking?
   - **Filler Usage:** Was there excessive use of "uh", "like", "you know", etc.?
   - **Hindi-English Switching:** Was bilingual language used fluidly, enhancing user comfort?

**3. DISCOVERY & NEED MAPPING:**
   - **Persona Identification:** Did the agent identify user type (student, investor, reader, casual)?
   - **Probing Depth:** Were insightful questions asked to unearth user interests or gaps?
   - **Active Listening:** Did the agent acknowledge and react to user inputs properly?
   - **Relevance Alignment:** Was the pitch shaped based on user needs (exams, time-saving, financial literacy, etc.)?

**4. SALES PITCH QUALITY:**
   - **Value Proposition Clarity:** Were ETPrime/TOI+ benefits presented clearly and powerfully?
   - **Feature-to-Need Fit:** Were features mapped to user pain points or objectives?
   - **Use of Quantifiable Value:** Were ₹5,000/₹7,000 value claims, plan discounts, or bundle savings referenced?
   - **Emotional Triggers:** Were FOMO, productivity, credibility, or ease-of-life triggers activated?
   - **Time Saving Emphasis:** Was the user shown how this product reduces research/time spent?
   - **Content Differentiation:** Was this positioned as deeper than “free news” or “OTT distractions”?

**5. OBJECTION HANDLING:**
   - **Price Objection Response:** Was the value of the offer framed against the price confidently?
   - **Relevance Objection:** Was “I don’t need it” tackled by reframing benefits or positioning?
   - **Content Overlap Objection:** Was duplication with free news or other platforms handled?
   - **Indecision Handling:** Did the agent detect fence-sitting and address uncertainty?
   - **Pushback Pivoting:** Were objections converted into renewed pitch angles?

**6. PLAN EXPLANATION & CLOSING TACTICS:**
   - **Plan Breakdown Clarity:** Were 1Y, 3Y, 7Y plans explained with exact pricing and inclusions?
   - **Bundle Leveraging:** Were Times Prime, DocuBay, ETWealth, or NYT explained as bonuses?
   - **Scarcity/Urgency Use:** Was limited-time or seasonal offer framing used?
   - **Assumptive Closing:** Did the agent behave as if user will convert (e.g., “Let me help you get started”)?
   - **Call-to-Action Strength:** Was the closing question strong, time-bound, and direct?

**7. ENDING & FOLLOW-UP:**
   - **Summarization:** Was there a quick recap of benefits and pricing?
   - **Next Step Clarity:** Was it clear what the user should do next — link, callback, payment, etc.?
   - **Closing Tone:** Was the final tone polite, confident, and non-desperate? (Infer from text)

**8. CONVERSION INDICATORS:**
   - **User Response Pattern:** Did the user give buying signals (asking about plans, price, validity)?
   - **Hesitation Patterns:** Was hesitation spotted and worked on?
   - **Momentum Building:** Did the call peak at the right time or lose steam?
   - **Conversion Readiness:** Based on tonality, objection clearance, and framing, is this user warm, cold, or hot? (Low/Medium/High)

**9. QUANTITATIVE ANALYSIS:**
   - **Talk-to-Listen Ratio:** Estimate the agent-to-user talk time ratio (e.g., 60/40, 50/50).
   - **Longest Monologue:** Identify the speaker (Agent or User) of the longest uninterrupted monologue and its estimated duration.
   - **Silence Analysis:** Was there significant dead air or long pauses?

**10. CRITICAL FLAWS / RED FLAGS:**
    - **Red Flags:** List any critical flaws, compliance breaches, major conversational missteps, or significant missed opportunities. If none, state "No critical red flags identified".

**FINAL OUTPUT SECTIONS:**
- **Final Summary:** Provide the Top 5 strengths AND Top 5 gaps.
- **Recommended Agent Coaching:** Provide a list of specific, actionable coaching feedbacks.

Your analysis must be exhaustive for every single point. No shortcuts.
`;
    
    const primaryModel = 'googleai/gemini-2.0-flash';
    const fallbackModel = 'googleai/gemini-1.5-flash-latest';
    let output;

    try {
        const { output: primaryOutput } = await ai.generate({
          model: primaryModel,
          prompt: scoringPromptText,
          output: { schema: ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true }), format: "json" },
          config: { temperature: 0.2 }
        });
        output = primaryOutput;
    } catch (e: any) {
       if (e.message.includes('429') || e.message.toLowerCase().includes('quota')) {
            console.warn(`Primary model (${primaryModel}) failed due to quota. Attempting fallback to ${fallbackModel}.`);
            try {
                const { output: fallbackOutput } = await ai.generate({
                    model: fallbackModel,
                    prompt: scoringPromptText,
                    output: { schema: ScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true }), format: "json" },
                    config: { temperature: 0.2 }
                });
                output = fallbackOutput;
            } catch (fallbackError: any) {
                console.error(`Fallback model (${fallbackModel}) also failed.`, fallbackError);
                throw fallbackError; // Re-throw the fallback error if it also fails
            }
        } else {
            // Re-throw if it's not a quota error
            throw e;
        }
    }


    if (!output) {
      throw new Error("AI failed to generate scoring details. The response from the scoring model was empty.");
    }

    const finalOutput: ScoreCallOutput = {
      ...output,
      transcript: transcriptResult.diarizedTranscript,
      transcriptAccuracy: transcriptResult.accuracyAssessment,
    };
    return finalOutput;
  }
);


// Wrapper function to handle potential errors and provide a consistent public API
export async function scoreCall(input: ScoreCallInput): Promise<ScoreCallOutput> {
  try {
    return await scoreCallFlow(input);
  } catch (err) {
    const error = err as Error;
    console.error("Catastrophic error caught in exported scoreCall function:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    let errorMessage = `A critical system error occurred in the scoring flow: ${error.message}.`;
    if (error.message.includes("429") || error.message.toLowerCase().includes("quota")) {
        errorMessage = `The call scoring service is currently unavailable due to high demand (API Quota Exceeded). Please try again after some time or check your API plan and billing details.`;
    }
    
    // Create a fallback object that conforms to the new, detailed schema
    const createErrorMetric = (feedback: string): { score: number; feedback: string } => ({ score: 1, feedback });
    
    return {
      transcript: input.transcriptOverride || `[System Error during scoring process execution. Raw Error: ${error.message}]`,
      transcriptAccuracy: "System Error",
      structureAndFlow: {
        callOpeningEffectiveness: createErrorMetric(errorMessage),
        greetingAndIntroductionClarity: createErrorMetric(errorMessage),
        callStructuring: createErrorMetric(errorMessage),
        segueSmoothness: createErrorMetric(errorMessage),
        timeManagement: createErrorMetric(errorMessage),
      },
      communicationAndDelivery: {
        voiceToneAppropriateness: createErrorMetric(errorMessage),
        energyLevel: createErrorMetric(errorMessage),
        pitchAndModulation: createErrorMetric(errorMessage),
        clarityOfSpeech: createErrorMetric(errorMessage),
        fillerUsage: createErrorMetric(errorMessage),
        hindiEnglishSwitching: createErrorMetric(errorMessage),
      },
      discoveryAndNeedMapping: {
          personaIdentification: createErrorMetric(errorMessage),
          probingDepth: createErrorMetric(errorMessage),
          activeListening: createErrorMetric(errorMessage),
          relevanceAlignment: createErrorMetric(errorMessage),
      },
      salesPitchQuality: {
          valuePropositionClarity: createErrorMetric(errorMessage),
          featureToNeedFit: createErrorMetric(errorMessage),
          useOfQuantifiableValue: createErrorMetric(errorMessage),
          emotionalTriggers: createErrorMetric(errorMessage),
          timeSavingEmphasis: createErrorMetric(errorMessage),
          contentDifferentiation: createErrorMetric(errorMessage),
      },
      objectionHandling: {
          priceObjectionResponse: createErrorMetric(errorMessage),
          relevanceObjection: createErrorMetric(errorMessage),
          contentOverlapObjection: createErrorMetric(errorMessage),
          indecisionHandling: createErrorMetric(errorMessage),
          pushbackPivoting: createErrorMetric(errorMessage),
      },
      planExplanationAndClosing: {
          planBreakdownClarity: createErrorMetric(errorMessage),
          bundleLeveraging: createErrorMetric(errorMessage),
          scarcityUrgencyUse: createErrorMetric(errorMessage),
          assumptiveClosing: createErrorMetric(errorMessage),
          callToActionStrength: createErrorMetric(errorMessage),
      },
      endingAndFollowUp: {
          summarization: createErrorMetric(errorMessage),
          nextStepClarity: createErrorMetric(errorMessage),
          closingTone: createErrorMetric(errorMessage),
      },
      conversionIndicators: {
          userResponsePattern: createErrorMetric(errorMessage),
          hesitationPatterns: createErrorMetric(errorMessage),
          momentumBuilding: createErrorMetric(errorMessage),
          conversionReadiness: "Low",
      },
      quantitativeAnalysis: {
        talkToListenRatio: "Error",
        longestMonologue: "Error",
        silenceAnalysis: "Error",
      },
      redFlags: [errorMessage],
      finalSummary: {
        topStrengths: ["N/A due to system error"],
        topGaps: ["Systemic failure in scoring flow execution"],
      },
      recommendedAgentCoaching: [`Investigate and resolve the critical system error: ${error.message.substring(0, 100)}...`],
    };
  }
}

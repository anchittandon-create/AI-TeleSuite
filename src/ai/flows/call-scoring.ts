
'use server';
/**
 * @fileOverview An exhaustively detailed, rubric-based call scoring analysis flow.
 * This flow provides a multi-dimensional analysis of a sales call based on a comprehensive set of metrics.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { transcribeAudio } from './transcription-flow';
import type { TranscriptionOutput } from './transcription-flow';
import { PRODUCTS, Product } from '@/types';

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


const MetricSchema = z.object({
  score: z.number().min(1).max(5).describe("Score for this specific metric (1-5)."),
  feedback: z.string().min(1).describe("Detailed analytical, insightful, and actionable comments for this metric. No summaries. Be thorough.")
});

const StructureAndFlowSchema = z.object({
    callOpeningEffectiveness: MetricSchema.describe("Evaluation of the immediate hook's strength within the first 5 seconds."),
    greetingAndIntroductionClarity: MetricSchema.describe("Assessment of how clearly brand, agent, and intent were established."),
    callStructuring: MetricSchema.describe("Analysis of the logical flow from introduction to closure."),
    segueSmoothness: MetricSchema.describe("Evaluation of how smoothly transitions were made between topics."),
    timeManagement: MetricSchema.describe("Assessment of whether the call length was optimal."),
});

const CommunicationAndDeliverySchema = z.object({
    voiceToneAppropriateness: MetricSchema.describe("Analysis of whether the agent's tone matched the user persona."),
    energyLevel: MetricSchema.describe("Evaluation of the consistency and confidence in the agent's energy."),
    pitchAndModulation: MetricSchema.describe("Assessment of the use of voice pitch changes to emphasize key ideas."),
    clarityOfSpeech: MetricSchema.describe("Evaluation of speech clarity, noting any mumbling or over-talking."),
    fillerUsage: MetricSchema.describe("Analysis of the use of filler words like 'uh', 'like', etc."),
    hindiEnglishSwitching: MetricSchema.describe("Evaluation of the fluid use of bilingual language to enhance user comfort."),
});

const DiscoveryAndNeedMappingSchema = z.object({
    personaIdentification: MetricSchema.describe("Assessment of the agent's ability to identify the user type (e.g., student, investor)."),
    probingDepth: MetricSchema.describe("Evaluation of the depth and insightfulness of questions asked to uncover user needs."),
    activeListening: MetricSchema.describe("Analysis of how well the agent acknowledged and reacted to user inputs."),
    relevanceAlignment: MetricSchema.describe("Assessment of whether the pitch was shaped based on identified user needs."),
});

const SalesPitchQualitySchema = z.object({
    valuePropositionClarity: MetricSchema.describe("Evaluation of how clearly product benefits were presented."),
    featureToNeedFit: MetricSchema.describe("Analysis of how well features were mapped to user pain points."),
    useOfQuantifiableValue: MetricSchema.describe("Assessment of the use of quantifiable value claims (e.g., price, discounts)."),
    emotionalTriggers: MetricSchema.describe("Evaluation of the activation of triggers like FOMO, productivity, or credibility."),
    timeSavingEmphasis: MetricSchema.describe("Assessment of how well the time-saving aspect of the product was emphasized."),
    contentDifferentiation: MetricSchema.describe("Analysis of how the product was positioned as superior to free alternatives."),
});

const ObjectionHandlingSchema = z.object({
    priceObjectionResponse: MetricSchema.describe("Evaluation of the confidence and framing in response to price objections."),
    relevanceObjection: MetricSchema.describe("Assessment of how 'I don't need it' objections were handled."),
    contentOverlapObjection: MetricSchema.describe("Analysis of handling objections about content duplication with free sources."),
    indecisionHandling: MetricSchema.describe("Evaluation of the agent's ability to detect and address user uncertainty."),
    pushbackPivoting: MetricSchema.describe("Assessment of how objections were converted into renewed pitch angles."),
});

const PlanExplanationAndClosingSchema = z.object({
    planBreakdownClarity: MetricSchema.describe("Evaluation of how clearly different plans (e.g., 1Y, 3Y) were explained."),
    bundleLeveraging: MetricSchema.describe("Analysis of how well bundled bonuses (e.g., Times Prime) were explained."),
    scarcityUrgencyUse: MetricSchema.describe("Assessment of the use of limited-time offer framing."),
    assumptiveClosing: MetricSchema.describe("Evaluation of the agent's use of assumptive closing techniques."),
    callToActionStrength: MetricSchema.describe("Assessment of the strength and directness of the closing question."),
});

const EndingAndFollowUpSchema = z.object({
    summarization: MetricSchema.describe("Evaluation of whether there was a quick recap of benefits and pricing."),
    nextStepClarity: MetricSchema.describe("Assessment of how clearly the next steps for the user were defined."),
    closingTone: MetricSchema.describe("Analysis of the final tone of the agent (polite, confident, etc.)."),
});

const ConversionIndicatorsSchema = z.object({
    userResponsePattern: MetricSchema.describe("Analysis of user buying signals (e.g., asking about plans, validity)."),
    hesitationPatterns: MetricSchema.describe("Evaluation of how user hesitation was spotted and addressed."),
    momentumBuilding: MetricSchema.describe("Assessment of whether the call peaked at the right time."),
    conversionReadiness: z.enum(["Low", "Medium", "High"]).describe("The AI's final assessment of how ready the user is to convert."),
});


const ExhaustiveScoreCallOutputSchema = z.object({
  transcript: z.string().describe('The full transcript of the call conversation.'),
  transcriptAccuracy: z.string().describe("The AI's qualitative assessment of the transcript's accuracy (e.g., 'High', 'Medium')."),
  
  structureAndFlow: StructureAndFlowSchema,
  communicationAndDelivery: CommunicationAndDeliverySchema,
  discoveryAndNeedMapping: DiscoveryAndNeedMappingSchema,
  salesPitchQuality: SalesPitchQualitySchema,
  objectionHandling: ObjectionHandlingSchema,
  planExplanationAndClosing: PlanExplanationAndClosingSchema,
  endingAndFollowUp: EndingAndFollowUpSchema,
  conversionIndicators: ConversionIndicatorsSchema,
  
  finalSummary: z.object({
      topStrengths: z.array(z.string()).min(5).describe("A list of the top 5 specific strengths from the call."),
      topGaps: z.array(z.string()).min(5).describe("A list of the top 5 specific gaps or areas for improvement."),
  }),
  
  recommendedAgentCoaching: z.array(z.string()).min(1).describe("A list of specific, actionable coaching feedback for the agent."),
});
export type ScoreCallOutput = z.infer<typeof ExhaustiveScoreCallOutputSchema>;

// This schema is used for the AI generation step ONLY. It omits the transcript fields.
const ScoreCallGenerationSchema = ExhaustiveScoreCallOutputSchema.omit({ transcript: true, transcriptAccuracy: true });


const scoreCallFlow = ai.defineFlow(
  {
    name: 'scoreCallFlow',
    inputSchema: ScoreCallInputSchema,
    outputSchema: ExhaustiveScoreCallOutputSchema,
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
Analyze the transcript exhaustively and provide a score (1-5) and detailed feedback for EVERY SINGLE METRIC listed below. Your output must be a single, valid JSON object that strictly conforms to the required schema.

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

**FINAL OUTPUT SECTIONS:**
- **Final Summary:** Provide the Top 5 strengths AND Top 5 gaps.
- **Recommended Agent Coaching:** Provide a list of specific, actionable coaching feedbacks.

Your analysis must be exhaustive for every single point. No shortcuts.
`;
    
    const primaryModel = 'googleai/gemini-1.5-flash-latest';
    const { output } = await ai.generate({
      model: primaryModel,
      prompt: scoringPromptText,
      output: { schema: ScoreCallGenerationSchema, format: "json" },
      config: { temperature: 0.2 }
    });

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
    
    const errorMessage = `A critical system error occurred in the scoring flow: ${error.message}.`;
    
    // Create a fallback object that conforms to the new, detailed schema
    const createErrorMetric = (feedback: string): { score: number; feedback: string } => ({ score: 1, feedback });
    
    return {
      transcript: `[System Error during scoring process execution. Raw Error: ${error.message}]`,
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
      finalSummary: {
        topStrengths: ["N/A due to system error"],
        topGaps: ["Systemic failure in scoring flow execution"],
      },
      recommendedAgentCoaching: [`Investigate and resolve the critical system error: ${error.message.substring(0, 100)}...`],
    };
  }
}

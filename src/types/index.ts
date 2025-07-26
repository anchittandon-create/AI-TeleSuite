

import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput, TrainingDeckFlowKnowledgeBaseItem } from '@/ai/flows/training-deck-generator';
import type { GeneratePitchOutput, GeneratePitchInput as OriginalGeneratePitchInput } from '@/ai/flows/pitch-generator'; // Renamed Original
import type { ScoreCallOutput, ScoreCallInput } from '@/ai/flows/call-scoring';
import type { GenerateRebuttalInput } from '@/ai/flows/rebuttal-generator';
import { z } from 'zod';


export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: string;
  agentName?: string;
  details?: string | object;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string;
  size: number;
  product?: string;
  persona?: CustomerCohort;
  uploadDate: string;
  textContent?: string;
  isTextEntry?: boolean;
}

export type Product = string;
export const PRODUCTS: string[] = ["ET", "TOI", "General"];

export interface ProductObject {
  name: string; // Unique system identifier
  displayName: string; // User-facing, editable name
  description?: string;
  brandName?: string;
  brandUrl?: string;
}


export type ETPlanConfiguration = "1, 2 and 3 year plans" | "1, 3 and 7 year plans";
export const ET_PLAN_CONFIGURATIONS: ETPlanConfiguration[] = ["1, 2 and 3 year plans", "1, 3 and 7 year plans"];

export type SalesPlan = "Monthly" | "Quarterly" | "Half-Yearly" | "1-Year" | "2-Years" | "3-Years" | "Custom";
export const SALES_PLANS: SalesPlan[] = ["Monthly", "Quarterly", "Half-Yearly", "1-Year", "2-Years", "3-Years", "Custom"];

export type CustomerCohort =
  | "Payment Dropoff"
  | "Paywall Dropoff"
  | "Plan Page Dropoff"
  | "Assisted Buying"
  | "Free Trial Nearing Expiry"
  | "Free Trial Expired"
  | "Based on Propensity Score"
  | "Expired Users"
  | "Post-Trial Follow-up"
  | "Loyalty & Retention"
  | "Payment Recovery & Renewals"
  | "New Prospect Outreach"
  | "Premium Upsell Candidates"
  | "Business Owners"
  | "Financial Analysts"
  | "Active Investors"
  | "Corporate Executives"
  | "Young Professionals"
  | "Students";


export const CUSTOMER_COHORTS: CustomerCohort[] = [
  "Payment Dropoff",
  "Paywall Dropoff",
  "Plan Page Dropoff",
  "Assisted Buying",
  "Free Trial Nearing Expiry",
  "Free Trial Expired",
  "Based on Propensity Score",
  "Expired Users",
  "Post-Trial Follow-up",
  "Loyalty & Retention",
  "Payment Recovery & Renewals",
  "New Prospect Outreach",
  "Premium Upsell Candidates",
  "Business Owners",
  "Financial Analysts",
  "Active Investors",
  "Corporate Executives",
  "Young Professionals",
  "Students"
];


export type CallScoreCategory = "Very Good" | "Good" | "Average" | "Bad" | "Very Bad" | "Error";
export const CALL_SCORE_CATEGORIES: CallScoreCategory[] = ["Very Good", "Good", "Average", "Bad", "Very Bad", "Error"];

export type UserProfile = "Anchit";
export const USER_PROFILES: UserProfile[] = ["Anchit"];

export interface HistoricalAnalysisReportItem extends Omit<ActivityLogEntry, 'details'> {
  details: {
    inputData: DataAnalysisInput;
    analysisOutput?: DataAnalysisReportOutput;
    error?: string;
  };
}

export interface TranscriptionActivityDetails {
  fileName: string;
  transcriptionOutput: TranscriptionOutput;
  error?: string;
}

export interface HistoricalTranscriptionItem extends Omit<ActivityLogEntry, 'details'> {
  details: {
    fileName: string;
    transcriptionOutput?: TranscriptionOutput;
    error?: string;
  };
}


export interface TrainingMaterialActivityDetails {
  materialOutput: GenerateTrainingDeckOutput;
  inputData: GenerateTrainingDeckInput;
  error?: string;
}

export interface HistoricalMaterialItem extends Omit<ActivityLogEntry, 'details'> {
  details: TrainingMaterialActivityDetails;
}

export const SynthesizeSpeechInputSchema = z.object({
  textToSpeak: z.string().min(1, "Text to speak cannot be empty.").max(5000, "Text to speak cannot exceed 5000 characters."),
  voiceProfileId: z.string().optional().describe('The ID of the pre-built voice to use for synthesis (e.g., a voice name supported by the TTS engine).'),
});
export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

export const SynthesizeSpeechOutputSchema = z.object({
    text: z.string().describe("The original text that was intended for speech synthesis."),
    audioDataUri: z.string().describe("A Data URI representing the synthesized audio (e.g., 'data:audio/wav;base64,...') or an error message placeholder if synthesis failed."),
    voiceProfileId: z.string().optional().describe("The voice profile ID that was actually used for synthesis."),
    errorMessage: z.string().optional().describe("Any error message if the synthesis had an issue."),
});
export type SimulatedSpeechOutput = z.infer<typeof SynthesizeSpeechOutputSchema>;


export interface ConversationTurn {
  id: string;
  speaker: 'AI' | 'User';
  text: string;
  timestamp: string;
  audioDataUri?: string; // AI turns will have it (placeholder or real), user turns may not.
  transcriptionAccuracy?: string;
  category?: string;
}

// Use OriginalGeneratePitchInput for specific fields needed by VoiceSalesAgentFlowInput
export interface GeneratePitchInput extends OriginalGeneratePitchInput {
  etPlanConfiguration?: ETPlanConfiguration;
}

export interface VoiceSalesAgentActivityDetails {
  input: {
    product: Product;
    customerCohort: CustomerCohort;
    agentName?: string;
    userName?: string;
  };
  finalScore?: {
    overallScore: number;
    callCategorisation: CallScoreCategory;
    summary: string;
  };
  fullTranscriptText?: string;
  error?: string;
}

export const VoiceSalesAgentFlowInputSchema = z.object({
  product: z.string(),
  productDisplayName: z.string(),
  salesPlan: z.string().optional(),
  etPlanConfiguration: z.string().optional(),
  offer: z.string().optional(),
  customerCohort: z.string(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  knowledgeBaseContext: z.string(),
  conversationHistory: z.array(z.custom<ConversationTurn>()),
  currentPitchState: z.custom<GeneratePitchOutput>().nullable(),
  currentUserInputText: z.string().optional(),
  action: z.enum([
    "START_CONVERSATION",
    "PROCESS_USER_RESPONSE",
    "GET_REBUTTAL",
    "END_CALL_AND_SCORE",
    "END_CALL_NO_SCORE",
  ]),
  voiceProfileId: z.string().optional(),
});
export type VoiceSalesAgentFlowInput = z.infer<typeof VoiceSalesAgentFlowInputSchema>;


export const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.custom<ConversationTurn>()),
    currentAiSpeech: z.custom<SimulatedSpeechOutput>().optional(),
    generatedPitch: z.custom<GeneratePitchOutput>().nullable(),
    rebuttalResponse: z.string().optional(),
    callScore: z.custom<ScoreCallOutput>().optional(),
    nextExpectedAction: z.enum([
        'USER_RESPONSE',
        'GET_REBUTTAL',
        'CONTINUE_PITCH',
        'END_CALL',
        'CALL_SCORED',
        'END_CALL_NO_SCORE',
    ]),
    errorMessage: z.string().optional(),
});
export type VoiceSalesAgentFlowOutput = z.infer<typeof VoiceSalesAgentFlowOutputSchema>;


export const VoiceSupportAgentFlowInputSchema = z.object({
  product: z.string(),
  agentName: z.string().optional().describe("Name of the AI agent (for dialogue)."),
  userName: z.string().optional().describe("Name of the user/customer (for dialogue)."),
  userQuery: z.string().min(1, "User query text must be provided."),
  voiceProfileId: z.string().optional().describe("Simulated ID of the cloned voice profile for AI's speech."),
  knowledgeBaseContext: z.string().min(10, "Knowledge base context is required and must be provided."),
});
export type VoiceSupportAgentFlowInput = z.infer<typeof VoiceSupportAgentFlowInputSchema>;


export const VoiceSupportAgentFlowOutputSchema = z.object({
    aiResponseText: z.string(),
    aiSpeech: z.custom<SimulatedSpeechOutput>().optional(),
    escalationSuggested: z.boolean().optional().describe("True if the AI suggests escalating to a human agent because it couldn't find an answer or the query requires it."),
    sourcesUsed: z.array(z.string()).optional().describe("Mentions of primary sources used by AI (e.g., 'Knowledge Base', 'Simulated Account Check')."),
    errorMessage: z.string().optional(),
});
export type VoiceSupportAgentFlowOutput = z.infer<typeof VoiceSupportAgentFlowOutputSchema>;

export interface VoiceSupportAgentActivityDetails {
  flowInput: VoiceSupportAgentFlowInput;
  flowOutput?: VoiceSupportAgentFlowOutput;
  fullTranscriptText?: string;
  simulatedInteractionRecordingRef?: string;
  error?: string;
}

export interface ExtendedGeneratePitchInput extends GeneratePitchInput {
  agentName?: string;
  userName?: string;
}

// Schemas for Combined Call Scoring Analysis
const IndividualCallScoreDataItemSchema = z.object({
  fileName: z.string(),
  scoreOutput: z.custom<ScoreCallOutput>() // Assuming ScoreCallOutput is already well-defined
});
export type IndividualCallScoreDataItem = z.infer<typeof IndividualCallScoreDataItemSchema>;

export const CombinedCallAnalysisInputSchema = z.object({
  callReports: z.array(IndividualCallScoreDataItemSchema).min(1, "At least one call report is required."),
  product: z.string().describe("The product focus for this batch of calls."),
  overallAnalysisGoal: z.string().optional().describe("Optional: A specific goal or focus for this combined analysis (e.g., 'Identify reasons for low conversion in this batch', 'Assess consistency in objection handling').")
});
export type CombinedCallAnalysisInput = z.infer<typeof CombinedCallAnalysisInputSchema>;

export const CombinedCallAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("Title for the combined analysis report (e.g., 'Combined Analysis for ET - Batch of 5 Calls')."),
  productFocus: z.string().describe("The product focus for this batch of calls."),
  numberOfCallsAnalyzed: z.number().int().describe("Total number of calls included in this combined analysis."),
  averageOverallScore: z.number().optional().describe("The average overall score calculated across all successfully analyzed calls. Omit if not calculable (e.g., all calls resulted in scoring errors)."),
  overallBatchCategorization: z.string().optional().describe("A qualitative categorization for the entire batch (e.g., 'Generally Strong Performance with room for improvement in X', 'Mixed Results - Significant inconsistencies noted', 'Requires Urgent Attention in Y and Z areas')."),
  
  batchExecutiveSummary: z.string().min(1).describe("A concise (2-4 sentences) high-level summary of the most critical findings, key takeaways, and actionable insights from the entire batch of calls."),
  
  commonStrengthsObserved: z.array(z.string()).describe("List 2-4 key strengths that were commonly observed across multiple calls in the batch. These should be specific and impactful (e.g., 'Consistent and clear product explanation in most calls', 'Effective rapport building at the start of interactions')."),
  commonAreasForImprovement: z.array(z.string()).describe("List 2-4 common areas for improvement identified from the batch. These should be specific and actionable (e.g., 'More proactive objection handling needed for price concerns', 'Inconsistent closing techniques observed', 'Improve discovery of customer needs beyond initial query')."),
  
  keyThemesAndTrends: z.array(z.object({
    theme: z.string().describe("A key theme or trend observed (e.g., 'Price Sensitivity Dominant Objection', 'Customer Confusion on Feature X', 'High Engagement on Benefit Y', 'Variable Call Opening Quality')."),
    description: z.string().describe("Brief description or examples illustrating this theme from the calls. Avoid simply restating the theme."),
    frequency: z.string().optional().describe("Qualitative frequency of this theme (e.g., 'Observed in most calls', 'Appeared in approximately half of the calls', 'Noted in a few significant instances').")
  })).min(1).describe("At least 1-3 notable themes, trends, or patterns observed across the batch of calls related to agent performance, customer responses, or call outcomes. Focus on insights that are not averages but represent patterns."),

  metricPerformanceSummary: z.array(z.object({
      metricName: z.string().describe("Name of a key performance metric (e.g., 'Opening & Rapport Building', 'Needs Discovery', 'Product Presentation Quality', 'Objection Handling Effectiveness', 'Closing Effectiveness', 'Clarity & Communication', 'Agent's Tone & Professionalism', 'User's Perceived Sentiment', 'Product Knowledge')."),
      batchPerformanceAssessment: z.string().describe("A qualitative summary of how this metric was performed across the batch (e.g., 'Consistently Strong', 'Generally Good with some exceptions', 'Mixed - varied widely between calls', 'Area of Common Weakness - requires focus', 'Not consistently evaluated across calls due to varying call nature')."),
      averageScore: z.number().optional().describe("If calculable from the provided individual scores, the average score for this metric across the batch (1-5). Omit if individual metric scores are not consistently available or calculable."),
      specificObservations: z.string().optional().describe("Brief, specific observations or examples related to this metric from the batch, if notable (e.g., 'Agents struggled with discovery questions beyond the initial statement', 'Product knowledge was excellent when discussing feature X, but lacking for feature Y').")
  })).describe("Summary of performance across 3-5 key metrics for the batch. Focus on overall trends rather than repeating individual call feedback."),
  
  individualCallHighlights: z.array(z.object({
    fileName: z.string(),
    overallScore: z.number(),
    briefSummary: z.string().max(150).describe("A one or two-sentence summary highlighting the most notable aspect of this individual call (e.g., 'Excellent example of overcoming price objection.', 'Showed very poor needs discovery despite long call duration.', 'Perfect closing technique demonstrated.')."),
  })).optional().describe("Optional: Brief highlights from up to 3-5 notable individual calls that exemplify key findings (e.g., highest/lowest scoring, best/worst practice examples for common themes).")
});
export type CombinedCallAnalysisReportOutput = z.infer<typeof CombinedCallAnalysisReportSchema>;


export interface CombinedCallAnalysisActivityDetails {
  input: CombinedCallAnalysisInput;
  output?: CombinedCallAnalysisReportOutput;
  error?: string;
  individualCallScoreDetails: Array<{
    fileName: string;
    score?: number; // individual call score
    error?: string; // error during individual scoring
  }>;
}

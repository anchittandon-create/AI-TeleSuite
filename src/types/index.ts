
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';
import type { GeneratePitchOutput, GeneratePitchInput as OriginalGeneratePitchInput } from '@/ai/flows/pitch-generator'; // Renamed Original
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { GenerateRebuttalInput } from '@/ai/flows/rebuttal-generator';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput as SynthesizeSpeechFlowOutput } from '@/ai/flows/speech-synthesis-flow';
import { z } from 'zod';


export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: 'ET' | 'TOI' | string;
  agentName?: string;
  details?: string | object;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string;
  size: number;
  product?: Product;
  persona?: CustomerCohort;
  uploadDate: string;
  textContent?: string;
  isTextEntry?: boolean;
}

export type Product = "ET" | "TOI";
export const PRODUCTS: Product[] = ["ET", "TOI"];

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
  details: TranscriptionActivityDetails;
}

export interface TrainingMaterialActivityDetails {
  materialOutput: GenerateTrainingDeckOutput;
  inputData: GenerateTrainingDeckInput;
  error?: string;
}

export interface HistoricalMaterialItem extends Omit<ActivityLogEntry, 'details'> {
  details: TrainingMaterialActivityDetails;
}

export interface VoiceProfile {
  id: string;
  name: string;
  sampleFileName?: string;
  createdAt: string;
  basePitch?: number;
  speakingRateWPM?: number;
  accentCode?: string;
  naturalness?: number;
  emotionProfile?: Array<'neutral' | 'happy' | 'serious' | 'emphatic'>;
  prosodyVariation?: number;
  timbre?: string;
  resonance?: string;
}

// Output from speech-synthesis-flow.ts, used by voice agents
export interface SimulatedSpeechOutput extends SynthesizeSpeechFlowOutput {}


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
  flowInput: Pick<SynthesizeSpeechInput, 'voiceProfileId'> & Pick<GeneratePitchInput, 'product' | 'customerCohort' | 'agentName' | 'userName' | 'salesPlan' | 'offer' | 'etPlanConfiguration'> & {action: string; userMobileNumber?: string; countryCode?: string;};
  flowOutput?: VoiceSalesAgentFlowOutput;
  finalScore?: ScoreCallOutput;
  fullTranscriptText?: string;
  simulatedCallRecordingRef?: string; // e.g., path or ID if actual recording was done
  error?: string;
}


export interface VoiceSupportAgentActivityDetails {
  flowInput: Pick<SynthesizeSpeechInput, 'voiceProfileId'> & Pick<GenerateRebuttalInput, 'product' | 'knowledgeBaseContext'> & {agentName?: string; userName?: string; userQuery: string; countryCode?:string; userMobileNumber?:string;};
  flowOutput?: VoiceSupportAgentFlowOutput;
  fullTranscriptText?: string;
  simulatedInteractionRecordingRef?: string;
  error?: string;
}

export interface ExtendedGeneratePitchInput extends GeneratePitchInput {
  agentName?: string;
  userName?: string;
}

// Output from voice-sales-agent-flow.ts
export interface VoiceSalesAgentFlowOutput {
  conversationTurns: ConversationTurn[];
  currentAiSpeech?: SimulatedSpeechOutput;
  generatedPitch?: GeneratePitchOutput;
  rebuttalResponse?: string;
  callScore?: ScoreCallOutput;
  nextExpectedAction: 'USER_RESPONSE' | 'GET_REBUTTAL' | 'CONTINUE_PITCH' | 'END_CALL' | 'CALL_SCORED' | 'END_CALL_NO_SCORE';
  errorMessage?: string;
}

// Output from voice-support-agent-flow.ts
export interface VoiceSupportAgentFlowOutput {
  aiResponseText: string;
  aiSpeech?: SimulatedSpeechOutput; // This will include the (potentially placeholder) audioDataUri
  escalationSuggested?: boolean;
  sourcesUsed?: string[];
  errorMessage?: string;
}

// Schemas for Combined Call Scoring Analysis
const IndividualCallScoreDataItemSchema = z.object({
  fileName: z.string(),
  scoreOutput: z.custom<ScoreCallOutput>() // Assuming ScoreCallOutput is already well-defined
});
export type IndividualCallScoreDataItem = z.infer<typeof IndividualCallScoreDataItemSchema>;

export const CombinedCallAnalysisInputSchema = z.object({
  callReports: z.array(IndividualCallScoreDataItemSchema).min(1, "At least one call report is required."),
  product: z.enum(PRODUCTS).describe("The product focus for this batch of calls."),
  overallAnalysisGoal: z.string().optional().describe("Optional: A specific goal or focus for this combined analysis (e.g., 'Identify reasons for low conversion in this batch', 'Assess consistency in objection handling').")
});
export type CombinedCallAnalysisInput = z.infer<typeof CombinedCallAnalysisInputSchema>;

export const CombinedCallAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("Title for the combined analysis report (e.g., 'Combined Analysis for ET - Batch of 5 Calls')."),
  productFocus: z.enum(PRODUCTS).describe("The product focus for this batch of calls."),
  numberOfCallsAnalyzed: z.number().int().positive().describe("Total number of calls included in this combined analysis."),
  averageOverallScore: z.number().min(0).max(5).optional().describe("The average overall score calculated across all successfully analyzed calls. Omit if not calculable (e.g., all calls resulted in scoring errors)."),
  overallBatchCategorization: z.string().optional().describe("A qualitative categorization for the entire batch (e.g., 'Generally Strong Performance with room for improvement in X', 'Mixed Results - Significant inconsistencies noted', 'Requires Urgent Attention in Y and Z areas')."),
  
  batchExecutiveSummary: z.string().min(1).describe("A concise (2-4 sentences) high-level summary of the most critical findings, key takeaways, and actionable insights from the entire batch of calls."),
  
  commonStrengthsObserved: z.array(z.string()).describe("List 2-4 key strengths that were commonly observed across multiple calls in the batch. These should be specific and impactful (e.g., 'Consistent and clear product explanation in most calls', 'Effective rapport building at the start of interactions')."),
  commonAreasForImprovement: z.array(z.string()).describe("List 2-4 common areas for improvement identified from the batch. These should be specific and actionable (e.g., 'More proactive objection handling needed for price concerns', 'Inconsistent closing techniques observed', 'Improve discovery of customer needs beyond initial query')."),
  
  keyThemesAndTrends: z.array(z.object({
    theme: z.string().describe("A key theme or trend observed (e.g., 'Price Sensitivity Dominant Objection', 'Customer Confusion on Feature X', 'High Engagement on Benefit Y', 'Variable Call Opening Quality')."),
    description: z.string().describe("Brief description or examples illustrating this theme from the calls. Avoid simply restating the theme."),
    frequency: z.string().optional().describe("Qualitative frequency of this theme (e.g., 'Observed in most calls', 'Appeared in approximately half of the calls', 'Noted in a few significant instances').")
  })).min(1).describe("At least 1-3 notable themes, trends, or patterns observed across the batch of calls related to agent performance, customer responses, or call outcomes. Focus on insights that are not just averages but represent patterns."),

  metricPerformanceSummary: z.array(z.object({
      metricName: z.string().describe("Name of a key performance metric (e.g., 'Opening & Rapport Building', 'Needs Discovery', 'Product Presentation Quality', 'Objection Handling Effectiveness', 'Closing Effectiveness', 'Clarity & Communication', 'Agent's Tone & Professionalism', 'User's Perceived Sentiment', 'Product Knowledge')."),
      batchPerformanceAssessment: z.string().describe("A qualitative summary of how this metric was performed across the batch (e.g., 'Consistently Strong', 'Generally Good with some exceptions', 'Mixed - varied widely between calls', 'Area of Common Weakness - requires focus', 'Not consistently evaluated across calls due to varying call nature')."),
      averageScore: z.number().min(0).max(5).optional().describe("If calculable from the provided individual scores, the average score for this metric across the batch (1-5). Omit if individual metric scores are not consistently available or calculable."),
      specificObservations: z.string().optional().describe("Brief, specific observations or examples related to this metric from the batch, if notable (e.g., 'Agents struggled with discovery questions beyond the initial statement', 'Product knowledge was excellent when discussing feature X, but lacking for feature Y').")
  })).describe("Summary of performance across 3-5 key metrics for the batch. Focus on overall trends rather than repeating individual call feedback."),
  
  individualCallHighlights: z.array(z.object({
    fileName: z.string(),
    overallScore: z.number().min(0).max(5),
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


import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer'; 
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';
import type { GeneratePitchOutput, GeneratePitchInput } from '@/ai/flows/pitch-generator';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { GenerateRebuttalInput } from '@/ai/flows/rebuttal-generator';
import type { SynthesizeSpeechInput, SynthesizeSpeechOutput as SynthesizeSpeechFlowOutput } from '@/ai/flows/speech-synthesis-flow'; // Renamed for clarity


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
  // Enhanced characteristics (conceptual for now)
  basePitch?: number; 
  speakingRateWPM?: number; 
  accentCode?: string; // e.g., 'en-IN-Standard', 'en-US-Standard', 'hi-IN-Standard'
  naturalness?: number; // 0-1
  emotionProfile?: Array<'neutral' | 'happy' | 'serious' | 'emphatic'>;
  prosodyVariation?: number; // 0-1 for degree of variation
  timbre?: string; // Descriptive (e.g., 'warm', 'bright', 'deep') - conceptual
  resonance?: string; // Descriptive (e.g., 'full', 'nasal') - conceptual
}

// Renamed to avoid conflict with flow's output type name
export interface SimulatedSpeechOutput { 
  text: string; 
  audioDataUri?: string; 
  voiceProfileId?: string; 
  errorMessage?: string; 
}

export interface ConversationTurn {
  id: string;
  speaker: 'AI' | 'User';
  text: string;
  timestamp: string;
  audioDataUri?: string; 
  transcriptionAccuracy?: string; 
  category?: string; 
}

// --- AI Voice Sales Agent Specific Types ---
// Input is defined in its flow file now
// Output is defined in its flow file now

export interface VoiceSalesAgentActivityDetails {
  flowInput: Pick<SynthesizeSpeechInput & GeneratePitchInput, 'product' | 'customerCohort' | 'agentName' | 'userName' | 'salesPlan' | 'offer' | 'voiceProfileId'> & {action: string; userMobileNumber?: string; countryCode?: string;};
  flowOutput?: VoiceSalesAgentFlowOutput; // Defined in its flow file
  finalScore?: ScoreCallOutput;
  fullTranscriptText?: string;
  simulatedCallRecordingRef?: string; 
  error?: string;
}


// --- AI Voice Support Agent Specific Types ---
// Input is defined in its flow file now
// Output is defined in its flow file now

export interface VoiceSupportAgentActivityDetails {
  flowInput: Pick<SynthesizeSpeechInput & GenerateRebuttalInput, 'product' | 'agentName' | 'userName' | 'voiceProfileId' | 'knowledgeBaseContext'> & {userQuery: string; countryCode?:string; userMobileNumber?:string;};
  flowOutput?: VoiceSupportAgentFlowOutput; // Defined in its flow file
  fullTranscriptText?: string; 
  simulatedInteractionRecordingRef?: string; 
  error?: string;
}

export interface ExtendedGeneratePitchInput extends GeneratePitchInput {
  agentName?: string;
  userName?: string;
}

// Forward declaration of flow outputs for use in activity details, actual types are in flow files.
export interface VoiceSalesAgentFlowOutput {
  conversationTurns: ConversationTurn[];
  currentAiSpeech?: SimulatedSpeechOutput; 
  generatedPitch?: GeneratePitchOutput; 
  rebuttalResponse?: string; 
  callScore?: ScoreCallOutput; 
  nextExpectedAction: 'USER_RESPONSE' | 'GET_REBUTTAL' | 'CONTINUE_PITCH' | 'END_CALL' | 'CALL_SCORED' | 'END_CALL_NO_SCORE';
  errorMessage?: string;
}

export interface VoiceSupportAgentFlowOutput {
  aiResponseText: string;
  aiSpeech?: SimulatedSpeechOutput; 
  escalationSuggested?: boolean;
  sourcesUsed?: string[]; 
  errorMessage?: string;
}


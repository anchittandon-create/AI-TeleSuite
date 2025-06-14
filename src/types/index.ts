
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer'; 
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';
import type { GeneratePitchOutput, GeneratePitchInput } from '@/ai/flows/pitch-generator';
import type { ScoreCallOutput } from '@/ai/flows/call-scoring';
import type { GenerateRebuttalInput } from '@/ai/flows/rebuttal-generator';


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
  | "Premium Upsell Candidates";

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
  "Premium Upsell Candidates"
];

export type CallScoreCategory = "Very Good" | "Good" | "Average" | "Bad" | "Very Bad" | "Error";
export const CALL_SCORE_CATEGORIES: CallScoreCategory[] = ["Very Good", "Good", "Average", "Bad", "Very Bad", "Error"];

export type UserProfile = "Anchit";
export const USER_PROFILES: UserProfile[] = ["Anchit"];

// Updated item type for Data Analysis Dashboard
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

// Types for AI Voice Agents
export interface VoiceProfile {
  id: string;
  name: string; 
  sampleFileName?: string;
  createdAt: string;
}

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
}

// --- AI Voice Sales Agent Specific Types ---
export interface VoiceSalesAgentFlowInput {
  product: Product;
  salesPlan?: SalesPlan;
  offer?: string;
  customerCohort: CustomerCohort;
  userMobileNumber?: string; 
  voiceProfileId?: string; 
  knowledgeBaseContext: string; 
  conversationHistory?: ConversationTurn[];
  currentUserInputText?: string;
  currentUserInputAudioDataUri?: string;
  currentPitchState?: any; 
  action: "START_CONVERSATION" | "PROCESS_USER_RESPONSE" | "GET_REBUTTAL" | "END_CALL_AND_SCORE";
}

export interface VoiceSalesAgentFlowOutput {
  conversationTurns: ConversationTurn[];
  currentAiSpeech?: SimulatedSpeechOutput; 
  generatedPitch?: GeneratePitchOutput; 
  rebuttalResponse?: string; 
  callScore?: ScoreCallOutput; 
  nextExpectedAction: 'USER_RESPONSE' | 'GET_REBUTTAL' | 'CONTINUE_PITCH' | 'END_CALL' | 'CALL_SCORED' | 'END_CALL_NO_SCORE';
  errorMessage?: string;
}

export interface VoiceSalesAgentActivityDetails {
  flowInput: Pick<VoiceSalesAgentFlowInput, 'product' | 'customerCohort' | 'action' | 'userMobileNumber' | 'salesPlan' | 'offer' | 'voiceProfileId'>; 
  flowOutput?: VoiceSalesAgentFlowOutput;
  finalScore?: ScoreCallOutput;
  fullTranscriptText?: string;
  error?: string;
}


// --- AI Voice Support Agent Specific Types ---
export interface VoiceSupportAgentFlowInput {
  product: Product;
  userQuery: string;
  voiceProfileId?: string; 
  knowledgeBaseContext: string; 
}

export interface VoiceSupportAgentFlowOutput {
  aiResponseText: string;
  aiSpeech?: SimulatedSpeechOutput; 
  escalationSuggested?: boolean;
  sourcesUsed?: string[]; 
  errorMessage?: string;
}

export interface VoiceSupportAgentActivityDetails {
  flowInput: VoiceSupportAgentFlowInput;
  flowOutput?: VoiceSupportAgentFlowOutput;
  error?: string;
}

    
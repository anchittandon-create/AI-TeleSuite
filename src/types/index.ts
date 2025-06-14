
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer'; // Updated import
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
  name: string; // e.g., "Uploaded Voice Sample 1"
  sampleFileName?: string;
  // Actual voice cloning parameters (pitch, rate, accent map) are complex and not fully modeled here for Genkit prototype
  // For simulation, we might just pass this profile ID or name to the TTS flow.
  createdAt: string;
}

export interface SimulatedSpeechOutput {
  text: string; // The text that was "spoken"
  audioDataUri?: string; // Placeholder for actual audio data from a real TTS
  voiceProfileId?: string; // ID of the voice profile used (simulated)
  errorMessage?: string; // If TTS simulation fails
}

export interface ConversationTurn {
  id: string;
  speaker: 'AI' | 'User';
  text: string;
  timestamp: string;
  audioDataUri?: string; // For AI speech or user's recorded speech
  transcriptionAccuracy?: string; // If user speech was transcribed
}

// --- AI Voice Sales Agent Specific Types ---
export interface VoiceSalesAgentFlowInput {
  product: Product;
  salesPlan?: SalesPlan;
  offer?: string;
  customerCohort: CustomerCohort;
  voiceProfileId?: string; // Simulated
  initialPitchInput?: GeneratePitchInput; // To generate the initial script
  userResponses?: Array<{ text: string, audioDataUri?: string }>; // History of user interactions
  currentObjectionText?: string; // If an objection needs a rebuttal
}

export interface VoiceSalesAgentFlowOutput {
  conversationTurns: ConversationTurn[];
  currentAiSpeech?: SimulatedSpeechOutput; // The latest thing the AI "said"
  generatedPitch?: GeneratePitchOutput; // The initial pitch
  rebuttalResponse?: string; // If a rebuttal was generated
  callScore?: ScoreCallOutput; // At the end of the call
  nextExpectedAction: 'USER_RESPONSE' | 'GET_REBUTTAL' | 'CONTINUE_PITCH' | 'END_CALL' | 'CALL_SCORED';
  errorMessage?: string;
}

export interface VoiceSalesAgentActivityDetails {
  flowInput: Partial<VoiceSalesAgentFlowInput>;
  flowOutput?: VoiceSalesAgentFlowOutput;
  finalScore?: ScoreCallOutput;
  fullTranscriptText?: string;
  error?: string;
}


// --- AI Voice Support Agent Specific Types ---
export interface VoiceSupportAgentFlowInput {
  product: Product;
  userQuery: string;
  voiceProfileId?: string; // Simulated
  knowledgeBaseContext: string; // Relevant KB content
  // Potentially conversation history if it becomes multi-turn
}

export interface VoiceSupportAgentFlowOutput {
  aiResponseText: string;
  aiSpeech?: SimulatedSpeechOutput; // The AI's spoken response
  escalationSuggested?: boolean;
  sourcesUsed?: string[]; // e.g., ["KB: ET Prime Benefits", "Simulated API: Account Status"]
  errorMessage?: string;
}

export interface VoiceSupportAgentActivityDetails {
  flowInput: VoiceSupportAgentFlowInput;
  flowOutput?: VoiceSupportAgentFlowOutput;
  error?: string;
}

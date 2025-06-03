
import type { DataAnalysisInput, DataAnalysisStrategyOutput } from '@/ai/flows/data-analyzer';
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator'; // Added import

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: 'ET' | 'TOI' | string;
  agentName?: string; // Will default to "Anchit" via useUserProfile
  details?: string | object; // Can be a simple string or a more complex object
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string; // MIME type or 'text/plain' for text entries
  size: number; // File size in bytes or character length for text
  product?: Product;
  persona?: CustomerCohort;
  uploadDate: string;
  textContent?: string; // For direct text entries
  isTextEntry?: boolean; // Flag to distinguish text entries from file uploads
}

export type Product = "ET" | "TOI";
export const PRODUCTS: Product[] = ["ET", "TOI"];

export type ETPlanConfiguration = "1, 2 and 3 year plans" | "1, 3 and 7 year plans";
export const ET_PLAN_CONFIGURATIONS: ETPlanConfiguration[] = ["1, 2 and 3 year plans", "1, 3 and 7 year plans"];


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

// UserProfile type is simplified to a fixed "Anchit" profile.
export type UserProfile = "Anchit";
export const USER_PROFILES: UserProfile[] = ["Anchit"];

// Moved from data-analysis-dashboard/page.tsx to break circular dependency
export interface HistoricalAnalysisStrategyItem extends Omit<ActivityLogEntry, 'details'> {
  details: {
    inputData: DataAnalysisInput;
    analysisOutput?: DataAnalysisStrategyOutput; // This is the playbook
    error?: string;
  };
}

// Details for Transcription Activity Log
export interface TranscriptionActivityDetails {
  fileName: string;
  transcriptionOutput: TranscriptionOutput;
  error?: string;
}

// Item for Transcription Dashboard
export interface HistoricalTranscriptionItem extends Omit<ActivityLogEntry, 'details'> {
  details: TranscriptionActivityDetails;
}

// Details for Training Material Activity Log
export interface TrainingMaterialActivityDetails {
  materialOutput: GenerateTrainingDeckOutput;
  inputData: GenerateTrainingDeckInput;
  error?: string;
}

// Item for Training Material Dashboard
export interface HistoricalMaterialItem extends Omit<ActivityLogEntry, 'details'> {
  details: TrainingMaterialActivityDetails;
}

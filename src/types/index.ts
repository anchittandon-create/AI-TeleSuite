
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/ai/flows/data-analyzer'; // Updated import
import type { TranscriptionOutput } from '@/ai/flows/transcription-flow';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/ai/flows/training-deck-generator';

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
    analysisOutput?: DataAnalysisReportOutput; // Changed from DataAnalysisStrategyOutput
    error?: string;
  };
}

export interface TranscriptionActivityDetails {
  fileName: string;
  transcriptionOutput: TranscriptionOutput;
  // audioDataUri?: string; // Not stored in activity log for history
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

    
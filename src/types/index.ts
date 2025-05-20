
export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: 'ET' | 'TOI' | string; // Updated
  agentName?: string;
  details?: string | object; 
}

export interface KnowledgeFile {
  id: string;
  name: string; // Optional if isTextEntry is true and textContent is used as name
  type: string; // Optional if isTextEntry is true
  size: number; // Optional if isTextEntry is true
  product?: 'ET' | 'TOI' | string; // Updated
  persona?: CustomerCohort | string; 
  uploadDate: string;
  textContent?: string; // For direct text/prompt entries
  isTextEntry?: boolean; // Flag to differentiate text entries from files
}

export type Product = "ET" | "TOI"; // Updated
export const PRODUCTS: Product[] = ["ET", "TOI"]; // Updated

export type ETPrimePlanType = "1-Year" | "3-Year" | "7-Year";
export const ETPRIME_PLAN_TYPES: ETPrimePlanType[] = ["1-Year", "3-Year", "7-Year"];


// Updated Customer Cohorts
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

// New type for Call Scoring Categorization
export type CallScoreCategory = "Very Good" | "Good" | "Average" | "Bad" | "Very Bad" | "Error";
export const CALL_SCORE_CATEGORIES: CallScoreCategory[] = ["Very Good", "Good", "Average", "Bad", "Very Bad", "Error"];


export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: 'ETPrime' | 'TOI+' | string;
  agentName?: string;
  details?: string | object; // E.g., generated pitch headline or rebuttal query
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string; // e.g., 'application/pdf', 'audio/mpeg'
  size: number; // in bytes
  product?: 'ETPrime' | 'TOI+' | string;
  persona?: CustomerCohort | string; // Target customer cohort for this knowledge file
  uploadDate: string;
}

export type Product = "ETPrime" | "TOI+";
export const PRODUCTS: Product[] = ["ETPrime", "TOI+"];

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
  | "Post-Trial Follow-up" // Kept from previous for compatibility, can be merged or removed if fully replaced
  | "Loyalty & Retention" // Kept from previous
  | "Payment Recovery & Renewals" // Kept from previous
  | "New Prospect Outreach" // Kept from previous
  | "Premium Upsell Candidates"; // Kept from previous

export const CUSTOMER_COHORTS: CustomerCohort[] = [
  "Payment Dropoff",
  "Paywall Dropoff",
  "Plan Page Dropoff",
  "Assisted Buying",
  "Free Trial Nearing Expiry",
  "Free Trial Expired",
  "Based on Propensity Score",
  "Expired Users",
  // Including previous ones too, review if these should be consolidated with the new ones
  "Post-Trial Follow-up",
  "Loyalty & Retention",
  "Payment Recovery & Renewals",
  "New Prospect Outreach",
  "Premium Upsell Candidates"
];

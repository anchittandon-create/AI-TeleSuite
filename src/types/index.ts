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
  persona?: string; // e.g., 'Free Trial Expired'
  uploadDate: string;
}

export type Product = "ETPrime" | "TOI+";
export const PRODUCTS: Product[] = ["ETPrime", "TOI+"];

export type CustomerCohort = "Free Trial Expired" | "Retention Campaign" | "Payment Drop-off" | "New Lead" | "Upsell Opportunity";
export const CUSTOMER_COHORTS: CustomerCohort[] = ["Free Trial Expired", "Retention Campaign", "Payment Drop-off", "New Lead", "Upsell Opportunity"];

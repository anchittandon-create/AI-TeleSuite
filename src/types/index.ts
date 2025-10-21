import { z } from 'zod';

// =================================================================
// Reusable Schemas
// =================================================================

// This is no longer needed here as it's defined locally in call-scoring.ts
// to prevent circular dependencies.
// export const ImprovementSituationSchema = z.object({ ... });


// =================================================================
// Product & Knowledge Base
// =================================================================

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string;
  size: number;
  product?: string;
  persona?: CustomerCohort;
  category?: string;
  uploadDate: string;
  textContent?: string;
  isTextEntry?: boolean;
  dataUri?: string; // To store content of uploaded files for download & preview
}

export type Product = string;

export interface ProductObject {
  name: string; // Unique system identifier
  displayName: string; // User-facing, editable name
  description?: string;
  brandName?: string;
  brandUrl?: string;
  customerCohorts?: string[]; // Now a flexible string array
  salesPlans?: string[]; // Now a flexible string array
  specialPlanConfigurations?: string[];
}

// This is now a list of *predefined* suggestions, not a strict enum
export const SALES_PLANS: readonly string[] = ["Monthly", "Quarterly", "Half-Yearly", "1-Year", "2-Years", "3-Years", "Custom"];
export type SalesPlan = (typeof SALES_PLANS)[number];

// This is now a list of *predefined* suggestions, not a strict enum
export const CUSTOMER_COHORTS: readonly string[] = [
  "Universal", "Payment Dropoff", "Paywall Dropoff", "Plan Page Dropoff", "Assisted Buying",
  "Free Trial Nearing Expiry", "Free Trial Expired", "Based on Propensity Score", "Expired Users",
  "Post-Trial Follow-up", "Loyalty & Retention", "Payment Recovery & Renewals",
  "New Prospect Outreach", "Premium Upsell Candidates", "Business Owners",
  "Financial Analysts", "Active Investors", "Corporate Executives", "Young Professionals", "Students"
];
export type CustomerCohort = (typeof CUSTOMER_COHORTS)[number];

export const ET_PLAN_CONFIGURATIONS: readonly string[] = [
  "1, 3 and 5 year plans",
  "1, 3 and 7 year plans",
  "1, 2 and 3 year plans",
];
export type ETPlanConfiguration = (typeof ET_PLAN_CONFIGURATIONS)[number];


// =================================================================
// User & Activity Logging
// =================================================================

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  module: string;
  product?: string;
  agentName?: string;
  details?: string | object | any;
}

export type UserProfile = "Anchit";
export const USER_PROFILES: UserProfile[] = ["Anchit"];


// =================================================================
// Transcription Flow
// =================================================================
export const TranscriptionInputSchema = z.object({
  audioDataUri: z.string().optional().describe(
    "An audio file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  audioUrl: z.string().url().optional().describe(
    "A public URL to an audio file. Use this for larger files to avoid passing large data URIs."
  ),
}).superRefine((data, ctx) => {
    if (!data.audioDataUri && !data.audioUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either audioDataUri or audioUrl must be provided.",
            path: ["audioDataUri"],
        });
    }
});
export type TranscriptionInput = z.infer<typeof TranscriptionInputSchema>;

export const TranscriptionOutputSchema = z.object({
  callMeta: z.object({
    sampleRateHz: z.number().nullable(),
    durationSeconds: z.number().nullable(),
  }),
  segments: z.array(z.object({
    startSeconds: z.number(),
    endSeconds: z.number(),
    speaker: z.enum(['AGENT', 'USER', 'SYSTEM']),
    speakerProfile: z.string(),
    text: z.string(),
  })),
  summary: z.object({
    overview: z.string(),
    keyPoints: z.array(z.string()),
    actions: z.array(z.string()),
  }),
});
export type TranscriptionOutput = z.infer<typeof TranscriptionOutputSchema>;


// =================================================================
// Call Scoring Flow
// =================================================================
export const CALL_SCORE_CATEGORIES = ["Excellent", "Good", "Average", "Needs Improvement", "Poor", "Error"] as const;
export type CallScoreCategory = (typeof CALL_SCORE_CATEGORIES)[number];

export const ScoreCallInputSchema = z.object({
  product: z.string().min(1, "Product is required."),
  agentName: z.string().optional(),
  audioDataUri: z.string().optional().describe("The full audio of the call as a data URI. Used for tonality analysis."),
  audioUrl: z.string().url().optional().describe("A public URL to an audio file. Use this for larger files to avoid passing large data URIs."),
  transcriptOverride: z.string().optional().describe("A full, pre-existing transcript of the call. If not provided, a transcript will be generated from audioDataUri."),
  productContext: z.string().optional().describe("A string containing concatenated knowledge base and product catalog information."),
  brandUrl: z.string().url().optional().describe("The official URL of the product brand for fallback knowledge retrieval."),
}).superRefine((data, ctx) => {
    if (!data.audioDataUri && !data.transcriptOverride && !data.audioUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either audioDataUri, audioUrl, or transcriptOverride must be provided.",
            path: ["audioDataUri"],
        });
    }
});
export type ScoreCallInput = z.infer<typeof ScoreCallInputSchema>;

export const ScoreCallOutputSchema = z.object({
  transcript: z.string(),
  transcriptAccuracy: z.string(),
  overallScore: z.number().describe("The single, overall score for the call, calculated as the average of all individual metric scores. Value is from 1 to 5."),
  callCategorisation: z.enum(CALL_SCORE_CATEGORIES),
  conversionReadiness: z.enum(["High", "Medium", "Low"]).describe("The AI's assessment of the user's likelihood to convert at the end of the call."),
  suggestedDisposition: z.string().describe("The suggested final call disposition for this call (e.g., 'Sale', 'Follow-up', 'Lead Nurturing', 'DNC - Do Not Call', 'Not Interested')."),
  summary: z.string().describe("A concise paragraph summarizing the entire call's key events, flow, and outcome."),
  strengths: z.array(z.string()).describe("A list of 2-3 key strengths observed during the call."),
  areasForImprovement: z.array(z.string()).describe("A list of 2-3 specific, actionable areas for improvement for the agent."),
  redFlags: z.array(z.string()).describe("A list of any critical issues observed, such as compliance breaches, major mis-selling of product features, or extremely poor customer service. If none, this should be an empty array."),
  metricScores: z.array(z.object({
    metric: z.string().describe("The specific metric being evaluated (e.g., 'Call Opening', 'Probing Depth', 'Price Objection Response')."),
    score: z.number().min(1).max(5).describe("The score for this metric, from 1 to 5."),
    feedback: z.string().describe("Detailed, specific, and actionable feedback for this metric."),
  })).describe("A comprehensive list of all evaluated metrics with their scores and feedback."),
  improvementSituations: z.array(z.any()).optional().describe("This field is defined dynamically in the flow to avoid circular dependencies. It contains specific situations for improvement."),
  timestamp: z.string().optional(),
});
export type ScoreCallOutput = z.infer<typeof ScoreCallOutputSchema>;


// =================================================================
// Data Analysis Flow
// =================================================================
const KeyMetricSchema = z.object({
  metricName: z.string().describe("Name of the Key Performance Indicator (KPI) or key metric identified (e.g., 'Overall Conversion Rate', 'Average Revenue Per Call', 'Lead Follow-up Rate', 'Connectivity %')."),
  value: z.string().describe("The calculated or inferred value of the metric (e.g., '15.2%', '₹350', '75%', '60%'). State if value cannot be determined from provided context. For calculated KPIs, briefly mention the assumed formula or source columns if not obvious."),
  trendOrComparison: z.string().optional().describe("Brief note on trend (e.g., 'Up 5% from last month', 'Stable') or comparison ('Highest among agents') if derivable from user's description."),
  insight: z.string().optional().describe("A brief insight related to this metric. (e.g. 'Indicates strong product-market fit for this cohort.')")
});

const ChartTableSuggestionSchema = z.object({
  type: z.enum(["Line Chart", "Bar Chart", "Pie Chart", "Table", "Heatmap", "Scatter Plot"]).describe("Suggested type of visualization."),
  title: z.string().describe("Title for the suggested chart/table (e.g., 'Monthly Revenue Trend', 'Agent Performance Comparison')."),
  description: z.string().describe("Brief description of what this chart/table would show and what data it would use from the user's described files (e.g., 'Line chart showing total revenue per month from Oct-May, using 'Revenue' column from ET MIS sheets.' or 'Table comparing Agent Name, Calls Made, Conversion %').")
});

export const DataAnalysisInputSchema = z.object({
  fileDetails: z.array(z.object({
    fileName: z.string().describe("The name of one of the user's files."),
    fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')."),
    fileDataUri: z.string().optional().describe("The data URI of the uploaded file for storage and later download.")
  })).min(1).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May containing columns: Agent Name, Calls Made, Revenue...', 'CDR Dump as ZIP of CSVs...'), their likely data structure (column headers, date formats, numeric vs categorical fields, AND CRITICALLY: any decoding rules for coded fields e.g., 'NR' = Not Reachable, 'CALLB' = Call Back, 'INT' = Interested), specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions and is CRITICAL for the AI to understand the data it cannot directly read. Describe any known messiness in the data if you want the AI to address hypothetical cleaning steps.").max(10000),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

export const DataAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("A comprehensive title for this specific data analysis report, reflecting the user's file context and analysis goals (e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)', 'Subscription Renewal Rate Analysis')."),
  executiveSummary: z.string().min(1).describe("A concise overview (2-3 bullet points or a short paragraph) of the most critical findings and actionable insights. This should explain what the data *means* at a high level."),
  keyMetrics: z.array(KeyMetricSchema).min(1).describe("An array of at least 1-3 key metrics or KPIs derived from the analysis (e.g., Conversion Rate, Lead Follow-up Rate, Connection Rate, Avg Revenue/Call). These should be specific and, where possible, quantified based on the user's description of their data. If revenue is missing, state how performance is being inferred (e.g., from intent outcome distribution)."),
  detailedAnalysis: z.object({
    dataReconstructionAndNormalizationSummary: z.string().optional().describe("A brief summary of how the AI *hypothetically* cleaned, reconstructed, or normalized the data tables based on the user's description of the data and its potential messiness. Explicitly mention how the user's detailed prompt (e.g., descriptions of column misalignments, merged rows, or specific null value representations) guided this simulated cleanup process."),
    smartTableRecognitionSummary: z.string().optional().describe("Brief summary of how the AI *inferred* the purpose of different described data tables/sheets (e.g., CDR, Daily MIS, Source Dump) based on the column names, sheet names, and context provided by the user in their detailed prompt."),
    timeSeriesTrends: z.string().optional().describe("Analysis of time-based trends (e.g., monthly/quarterly growth, dips, seasonality in revenue, calls, conversions, connection rates). Describe what patterns are observed and potential reasons based on described data context. Highlight any significant monthly changes."),
    comparativePerformance: z.string().optional().describe("Comparison of performance across different categories such as agents or cohorts. Identify top/low performers or significant variances. For agents, discuss insights like 'Agent A converted fewer leads despite high talktime'. For cohorts, identify which ones are being ignored or over-performing, and their ROI if inferable."),
    useCaseSpecificInsights: z.string().optional().describe("Insights specific to telecalling operations, campaign attribution, incentive effectiveness, or sales funnel leakages, as suggested by the user's prompt and data description. Examples: insights on lead connectivity, conversion rates at different funnel stage, agent productivity variations, cohort ROI, incentive impact, or reasons for low follow-up causing low conversions. If something seems off (e.g., very low call duration based on user's description), flag it as a red flag and suggest possible causes."),
  }).describe("Detailed breakdown of analytical findings, covering hypothetical data prep, table interpretations, agent-level insights, cohort trends, and other use-case specific points."),
  chartsOrTablesSuggestions: z.array(ChartTableSuggestionSchema).optional().describe("Suggestions for 1-2 charts or tables that would best visualize the key findings."),
  recommendations: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Agent Training, Cohort Strategy, Lead Management, Process Improvement, Incentive Adjustment)."),
    recommendation: z.string().describe("A specific, actionable recommendation based on the analysis (e.g., 'Train low-performing agents on X', 'Focus more on Payment Drop-offs cohort due to high ROI potential')."),
    justification: z.string().optional().describe("Briefly mention the analysis findings or data patterns (from user's description) that support this recommendation.")
  })).min(1).describe("At least 1-2 actionable recommendations or next steps derived from the analysis."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided: 2-3 specific insights, simple calculations (e.g. 'Average X from sample is Y'), or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes based on a 'Duration' column.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context. The accuracy and depth of this analysis are directly proportional to the detail provided in the user's input prompt."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;


// =================================================================
// Pitch & Rebuttal Flows
// =================================================================
export const GeneratePitchInputSchema = z.object({
  product: z.string().min(1, "Product must be selected."),
  customerCohort: z.string().min(1, "Customer cohort must be selected."),
  specialPlanConfigurations: z.string().optional(),
  knowledgeBaseContext: z.string().describe('A structured string of knowledge base content. It contains sections like "--- PITCH STRUCTURE & FLOW CONTEXT ---" and "--- PRODUCT DETAILS & FACTS ---" which the AI must use for their designated purposes. It may also contain a "--- START OF USER-SELECTED KB CONTEXT ---" section which MUST be prioritized.'),
  optimizationContext: z.string().optional().describe("Insights from a combined call analysis to guide pitch optimization. Contains strengths to lean into and weaknesses to address."),
  salesPlan: z.string().optional(),
  offer: z.string().optional(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  brandName: z.string().optional(),
  brandUrl: z.string().url().optional(),
});
export type GeneratePitchInput = z.infer<typeof GeneratePitchInputSchema>;

export const GeneratePitchOutputSchema = z.object({
  pitchTitle: z.string().describe("A compelling title for the sales pitch."),
  warmIntroduction: z.string().describe("A brief, friendly opening, introducing the agent (if name provided) and the product brand. This MUST be concise and derived *ONLY* from Knowledge Base cues if available (e.g., standard greeting), otherwise general professional greeting. Ensure this content is distinct from other sections."),
  personalizedHook: z.string().describe("A hook tailored to the user's cohort, explaining the reason for the call and possibly hinting at benefits or offers relevant to that cohort. This section MUST use specifics *ONLY* from the Knowledge Base if available for the cohort or product, otherwise a generic professional hook for the cohort. Ensure this content is distinct and does not repeat Warm Introduction or Product Explanation points."),
  productExplanation: z.string().min(10).describe("Clear explanation of the product, focusing on its core value proposition to the customer. This MUST be derived *ONLY* from the '--- PRODUCT DETAILS & FACTS ---' section of the Knowledge Base. Do not repeat information from the hook if it covered product basics. Ensure this content is distinct and does not repeat benefits detailed in 'keyBenefitsAndBundles'. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  keyBenefitsAndBundles: z.string().min(10).describe("Highlight 2-4 key benefits and any bundled offers. This MUST be derived *ONLY* from the '--- PRODUCT DETAILS & FACTS ---' section of the Knowledge Base. Explain added value to the customer. Ensure these benefits are distinct and not just rephrasing the Product Explanation. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  discountOrDealExplanation: z.string().describe("Explanation of any specific discount or deal. If no offer, mention plan availability. Use <INSERT_PRICE> placeholder. This MUST be derived *ONLY* from the '--- PRODUCT DETAILS & FACTS ---' section of the Knowledge Base. If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  objectionHandlingPreviews: z.string().describe("Proactively address 1-2 common objections with brief rebuttals. This MUST be based *ONLY* on information in the '--- PRODUCT DETAILS & FACTS ---' or '--- GENERAL SUPPLEMENTARY CONTEXT ---' sections of the Knowledge Base (e.g., 'Common Selling Themes'). If context is sparse, state what kind of info would be here and refer agent to KB/source file."),
  finalCallToAction: z.string().describe("A clear and direct call to action, prompting the customer to proceed or request more information. This MUST be specific and actionable, and feel like a natural conclusion to the preceding points."),
  fullPitchScript: z.string().min(50).describe("The complete sales pitch script, formatted as a DIALOGUE primarily from the AGENT's perspective (use 'Agent:' label, or the agent's name if provided). You may include very brief, implied customer interjections or listening cues (e.g., 'Customer: (Listening)', 'Customer: Mm-hmm', or the customer's name if provided) to make it flow naturally. This script MUST smoothly integrate all distinct components above without excessive repetition, creating a natural, flowing conversation. Target 450-600 words for the agent's parts. Use placeholders like {{AGENT_NAME}}, {{USER_NAME}}, {{PRODUCT_NAME}}, {{USER_COHORT}}, {{PLAN_NAME}}, {{OFFER_DETAILS}}, <INSERT_PRICE>."),
  estimatedDuration: z.string().describe("Estimated speaking duration of the agent's parts in the full pitch script (e.g., '3-5 minutes')."),
  notesForAgent: z.string().optional().describe("Optional brief notes or tips for the agent specific to this pitch, product, and cohort (e.g., 'Emphasize X benefit for this cohort'). Include a note here if the AI could not directly process an uploaded file's content and had to rely on metadata or any general KB.")
});
export type GeneratePitchOutput = z.infer<typeof GeneratePitchOutputSchema>;

export const GenerateRebuttalInputSchema = z.object({
  objection: z.string().describe('The customer objection.'),
  product: z.string().min(1, "Product must be selected."),
  knowledgeBaseContext: z.string().describe('Concatenated relevant knowledge base content for the specified product. This is the sole source for rebuttal generation.'),
  brandUrl: z.string().url().optional(),
});
export type GenerateRebuttalInput = z.infer<typeof GenerateRebuttalInputSchema>;

export const GenerateRebuttalOutputSchema = z.object({
  rebuttal: z.string().describe('A contextual rebuttal to the customer objection. It should be well-structured, empathetic, and directly address the customer\'s concern. Prioritize using KB information. If KB is sparse for the specific objection, use general knowledge to structure a helpful response while still grounding it in the product context.'),
});
export type GenerateRebuttalOutput = z.infer<typeof GenerateRebuttalOutputSchema>;


// =================================================================
// Training Deck Flow
// =================================================================
export const TrainingDeckFlowKnowledgeBaseItemSchema = z.object({
  name: z.string().describe("Name of the knowledge base item (e.g., file name, text entry title, or 'User-Provided Prompt')."),
  textContent: z.string().optional().describe("Full text content if the item is a text entry from KB, a small directly uploaded text file, or the direct user prompt."),
  isTextEntry: z.boolean().describe("Whether this item is a direct text entry from the KB or a direct user prompt."),
  fileType: z.string().optional().describe("MIME type of the file, if applicable (especially for direct uploads). Will be 'text/plain' for prompts.")
});
export type TrainingDeckFlowKnowledgeBaseItem = z.infer<typeof TrainingDeckFlowKnowledgeBaseItemSchema>;

export const GenerateTrainingDeckInputSchema = z.object({
  product: z.string().describe('The product (ET or TOI) the training material is for.'),
  deckFormatHint: z.enum(["PDF", "Word Doc", "PPT", "Brochure"]).describe('The intended output format (influences content structure suggestion).'),
  knowledgeBaseItems: z.array(TrainingDeckFlowKnowledgeBaseItemSchema).describe('An array of contextual items: selected KB items, items derived from direct file uploads, OR a single item representing a direct user prompt. For KB files or larger/binary direct uploads, only name/type is primary context unless textContent is provided. For text entries from KB or direct prompts, full textContent is available.'),
  generateFromAllKb: z.boolean().describe('If true, knowledgeBaseItems represents the entire KB relevant to the product (and direct uploads/prompts are ignored).'),
  sourceDescriptionForAi: z.string().optional().describe("A brief description of the source of the knowledgeBaseItems (e.g., 'selected KB items', 'entire KB for ET', 'directly uploaded files: report.docx, notes.txt', 'a direct user-provided prompt requesting ET Prime Sales Training'). This helps the AI understand the context source.")
});
export type GenerateTrainingDeckInput = z.infer<typeof GenerateTrainingDeckInputSchema>;

const ContentSectionSchema = z.object({
  title: z.string().describe("The title of this section/slide/panel."),
  content: z.string().describe("The main content for this section, formatted with bullet points, paragraphs, or concise statements as appropriate for the target format. Keep content focused for each section. For brochures, content should be persuasive and benefit-oriented, including textual suggestions for visuals e.g., (Visual: Happy customer using product)."),
  notes: z.string().optional().describe("Optional speaker notes for slides, or internal notes/suggestions for brochure panels (e.g., 'Use vibrant background', 'Feature customer testimonial', 'Visual Suggestion Detail: ...').")
});

export const GenerateTrainingDeckOutputSchema = z.object({
  deckTitle: z.string().describe("The overall title for the training material (deck or brochure)."),
  sections: z.array(ContentSectionSchema).min(3).describe("An array of at least 3 sections/slides/panels. For decks: intro, content, conclusion. For brochures: cover panel, internal panels, call-to-action panel."),
});
export type GenerateTrainingDeckOutput = z.infer<typeof GenerateTrainingDeckOutputSchema>;


// =================================================================
// Voice Agent & Audio Flows
// =================================================================
export interface ConversationTurn {
  id: string;
  speaker: 'AI' | 'User';
  text: string;
  timestamp: string;
  audioDataUri?: string;
}

export const VoiceSalesAgentFlowInputSchema = z.object({
  action: z.enum(["START_CONVERSATION", "PROCESS_USER_RESPONSE", "END_CALL"]),
  product: z.string(),
  productDisplayName: z.string(),
  brandName: z.string().optional(),
  brandUrl: z.string().url().optional(),
  salesPlan: z.string().optional(),
  specialPlanConfigurations: z.string().optional(),
  offer: z.string().optional(),
  customerCohort: z.string(),
  agentName: z.string().optional(),
  userName: z.string().optional(),
  knowledgeBaseContext: z.string(),
  conversationHistory: z.array(z.custom<ConversationTurn>()),
  currentPitchState: z.custom<GeneratePitchOutput>().nullable(),
  currentUserInputText: z.string().optional(),
  inactivityCounter: z.number().optional(),
});
export type VoiceSalesAgentFlowInput = z.infer<typeof VoiceSalesAgentFlowInputSchema>;

export const VoiceSalesAgentFlowOutputSchema = z.object({
    conversationTurns: z.array(z.custom<ConversationTurn>()),
    currentAiResponseText: z.string().optional(),
    generatedPitch: z.custom<GeneratePitchOutput>().nullable(),
    nextExpectedAction: z.enum(['USER_RESPONSE', 'END_CALL_NO_SCORE', 'INTERACTION_ENDED']),
    errorMessage: z.string().optional(),
});
export type VoiceSalesAgentFlowOutput = z.infer<typeof VoiceSalesAgentFlowOutputSchema>;

export const VoiceSupportAgentFlowInputSchema = z.object({
  product: z.string(),
  agentName: z.string().optional().describe("Name of the AI agent (for dialogue)."),
  userName: z.string().optional().describe("Name of the user/customer (for dialogue)."),
  userQuery: z.string().min(1, "User query text must be provided."),
  knowledgeBaseContext: z.string().min(10, "Knowledge base context is required and must be provided."),
  conversationHistory: z.array(z.custom<ConversationTurn>()).optional(),
  brandUrl: z.string().url().optional(),
});
export type VoiceSupportAgentFlowInput = z.infer<typeof VoiceSupportAgentFlowInputSchema>;

export const VoiceSupportAgentFlowOutputSchema = z.object({
    aiResponseText: z.string().optional(),
    escalationSuggested: z.boolean().default(false),
    sourcesUsed: z.array(z.string()).optional(),
    errorMessage: z.string().optional(),
    requiresLiveDataFetch: z.boolean().optional(),
    isUnanswerableFromKB: z.boolean().optional(),
});
export type VoiceSupportAgentFlowOutput = z.infer<typeof VoiceSupportAgentFlowOutputSchema>;

export const GenerateFullCallAudioInputSchema = z.object({
    conversationHistory: z.array(z.custom<ConversationTurn>()).optional().describe("The full history of the conversation, with 'AI' and 'User' speakers."),
    agentVoiceProfile: z.string().optional().describe("The voice profile ID from Google's catalog (e.g., 'en-IN-Wavenet-D')."),
    singleSpeakerText: z.string().optional().describe("If provided, generate audio for this single text string instead of the conversation history."),
});
export type GenerateFullCallAudioInput = z.infer<typeof GenerateFullCallAudioInputSchema>;

export const GenerateFullCallAudioOutputSchema = z.object({
    audioDataUri: z.string().describe("The Data URI of the generated WAV audio file for the full call."),
    errorMessage: z.string().optional(),
});
export type GenerateFullCallAudioOutput = z.infer<typeof GenerateFullCallAudioOutputSchema>;


// =================================================================
// Combined Call Analysis & Pitch Optimization Flows
// =================================================================
const IndividualCallScoreDataItemSchema = z.object({
  fileName: z.string(),
  scoreOutput: z.custom<ScoreCallOutput>()
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
  averageOverallScore: z.number().optional().describe("The average overall score calculated across all valid individual reports. Omit if not calculable."),
  overallBatchCategorization: z.string().optional().describe("A qualitative categorization for the entire batch (e.g., 'Generally Strong Performance with room for improvement in X', 'Mixed Results - Significant inconsistencies noted')."),
  batchExecutiveSummary: z.string().min(1).describe("A concise (2-4 sentences) high-level summary of the most critical findings and actionable insights from the entire batch of calls."),
  commonStrengthsObserved: z.array(z.string()).describe("List 2-4 key strengths that were commonly observed across multiple calls in the batch."),
  commonAreasForImprovement: z.array(z.string()).describe("List 2-4 common areas for improvement identified from the batch."),
  commonRedFlags: z.array(z.string()).optional().describe("A list of critical flaws or 'red flags' that appeared more than once across the batch of calls (e.g. compliance issues, rude behavior)."),
  keyThemesAndTrends: z.array(z.object({
    theme: z.string().describe("A key theme or trend observed (e.g., 'Price Sensitivity Dominant Objection', 'Customer Confusion on Feature X')."),
    description: z.string().describe("Brief description or examples illustrating this theme from the calls."),
    frequency: z.string().optional().describe("Qualitative frequency of this theme (e.g., 'Observed in most calls', 'Appeared in approximately half of the calls').")
  })).min(1).describe("At least 1-3 notable themes, trends, or patterns observed across the batch of calls."),
  metricPerformanceSummary: z.array(z.object({
      metricName: z.string().describe("Name of a key performance metric (e.g., 'Opening & Rapport Building', 'Objection Handling Effectiveness')."),
      batchPerformanceAssessment: z.string().describe("A qualitative summary of how this metric was performed across the batch."),
      averageScore: z.number().optional().describe("If calculable, the average score for this metric across the batch (1-5)."),
      specificObservations: z.string().optional().describe("Brief, specific observations or examples related to this metric from the batch."),
  })).describe("Summary of performance across 3-5 key metrics for the batch."),
  individualCallHighlights: z.array(z.object({
    fileName: z.string(),
    overallScore: z.number(),
    briefSummary: z.string().max(150).describe("A one or two-sentence summary highlighting the most notable aspect of this individual call."),
  })).optional().describe("Optional: Brief highlights from up to 3-5 notable individual calls that exemplify key findings.")
});
export type CombinedCallAnalysisReportOutput = z.infer<typeof CombinedCallAnalysisReportSchema>;

export const OptimizedPitchGenerationInputSchema = z.object({
  product: z.string(),
  cohortsToOptimize: z.array(z.string()).min(1),
  analysisReport: CombinedCallAnalysisReportSchema,
  knowledgeBaseContext: z.string(),
});
export type OptimizedPitchGenerationInput = z.infer<typeof OptimizedPitchGenerationInputSchema>;

export const OptimizedPitchGenerationOutputSchema = z.object({
  optimizedPitches: z.array(
    z.object({
      cohort: z.string(),
      pitch: GeneratePitchOutputSchema,
    })
  ),
});
export type OptimizedPitchGenerationOutput = z.infer<typeof OptimizedPitchGenerationOutputSchema>;


// =================================================================
// Misc Types For Activity Logs, etc.
// =================================================================

export interface CallScoringActivityDetails {
  fileName: string;
  scoreOutput?: ScoreCallOutput;
  agentNameFromForm?: string;
  error?: string;
  status?: 'Queued' | 'Transcribing' | 'Scoring' | 'Complete' | 'Failed';
  audioDataUri?: string;
  source?: 'Manual' | 'Voice Agent';
}

export interface HistoricalScoreItem extends Omit<ActivityLogEntry, 'details'> {
  details: CallScoringActivityDetails;
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

export interface CombinedCallAnalysisActivityDetails {
  input: CombinedCallAnalysisInput;
  output?: CombinedCallAnalysisReportOutput;
  error?: string;
  individualCallScoreDetails: Array<{
    fileName: string;
    score?: number;
    error?: string;
  }>;
}

export interface VoiceSalesAgentActivityDetails {
  input: {
    product: Product;
    customerCohort: CustomerCohort;
    agentName?: string;
    userName?: string;
    voiceName?: string;
    selectedKbIds?: string[];
  };
  finalScore?: Partial<ScoreCallOutput>;
  lastCallFeedbackContext?: string;
  fullTranscriptText?: string;
  fullConversation?: ConversationTurn[];
  fullCallAudioDataUri?: string;
  status?: 'In Progress' | 'Completed' | 'Error' | 'Completed (Reset)' | 'Completed (Page Unloaded)' | 'Processing Audio';
  error?: string;
}

export interface VoiceSupportAgentActivityDetails {
  flowInput: VoiceSupportAgentFlowInput;
  flowOutput?: VoiceSupportAgentFlowOutput;
  fullTranscriptText?: string;
  fullConversation?: ConversationTurn[];
  fullCallAudioDataUri?: string;
  finalScore?: Partial<ScoreCallOutput>;
  status?: 'In Progress' | 'Completed' | 'Error' | 'Completed (Reset)' | 'Completed (Page Unloaded)';
  error?: string;
}

export interface HistoricalAnalysisReportItem extends Omit<ActivityLogEntry, 'details'> {
  details: {
    inputData: DataAnalysisInput;
    analysisOutput?: DataAnalysisReportOutput;
    error?: string;
  };
}

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  speaker: 'AGENT' | 'USER' | 'SYSTEM';
  speakerProfile: string;
  text: string;
};

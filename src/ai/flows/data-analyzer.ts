
'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis strategist.
 * This AI acts as an expert advisor. It takes a detailed user prompt describing their data files (Excel, CSV, etc.),
 * their likely structure, and their specific analytical goals.
 * Based on this, the AI generates a comprehensive "Analysis Playbook" - a strategic guide
 * that outlines how the user can perform the desired analysis using their own tools.
 *
 * If a small sample of a text-based file (CSV/TXT) is provided, the AI will also attempt
 * to derive 2-3 direct, concrete insights from that sample, in addition to the main playbook.
 *
 * The AI does NOT directly process or perform calculations on the internal content of large binary files like Excel.
 *
 * - generateDataAnalysisStrategy - A function that generates an analysis strategy.
 * - DataAnalysisStrategyInput - The input type for the function.
 * - DataAnalysisStrategyOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schema for the input to the AI flow
const DataAnalysisStrategyInputSchema = z.object({
  fileDetails: z.array(z.object({
    fileName: z.string().describe("The name of one of the user's files."),
    fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').")
  })).min(1).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May...', 'CDR Dump as ZIP of CSVs...'), their likely data structure, and specific analytical goals (e.g., 'Analyze sales trends MoM for Q4 & Q1, identify top agents...'). This is the primary input for the AI to generate its strategic playbook."),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available, but the main output is still a strategic playbook. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisStrategyInput = z.infer<typeof DataAnalysisStrategyInputSchema>;

// Schema for the structured "Analysis Playbook" output from the AI
const DataAnalysisStrategyOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise and relevant title for the generated Analysis Playbook (e.g., 'Strategic Analysis Plan for Monthly Business Performance Data', 'Telecalling Performance Deep Dive Strategy')."),
  executiveSummary: z.string().describe("Bullet points summarizing the overall recommended analysis strategy and the potential high-level insights the user might aim to uncover by following this playbook."),
  dataUnderstandingAndPreparationGuide: z.string().describe("Guidance based on user's STEP 1 (Clean & Prepare Data). Include advice on standardizing column names, data type conversions, handling missing values, and parsing date/time for the described files (CDR, MIS, Revenue sheets). Suggest adding a 'Month' column if needed."),
  keyMetricsAndKPIsToFocusOn: z.array(z.string()).min(3).describe("A list of at least 3 key metrics and KPIs the user should focus on calculating or tracking, based on their described goals and files (e.g., 'Monthly Recurring Revenue (MRR) Growth Rate', 'Agent-wise Conversion Rate (Sales/Unique Leads)', 'Average Handle Time (AHT)', 'Cohort Retention Rate', 'Lead Source ROI')."),
  suggestedAnalyticalSteps: z.array(z.object({
    area: z.string().describe("The analysis area, mapping to user's requested steps (e.g., 'Metric Calculation Guidance (STEP 2)', 'Trend Analysis Across Months (STEP 3)', 'Lead & Agent Performance Deep Dive (STEP 3)', 'Cohort/Source-Wise Funnel Drop-offs (STEP 4)', 'Attribution & Campaign Effectiveness (STEP 5)', 'Insight Generation & Issue Flagging (STEP 7)')."),
    steps: z.string().describe("Detailed textual guidance for this area: key questions to ask, data points/files to correlate, and methods to use. For example, for Trend Analysis, explain how to compare KPIs MoM, identify peaks/slumps, and hypothesize reasons. For Agent Performance, how to correlate conversion and revenue, etc.")
  })).min(3).describe("At least 3 detailed sections outlining analytical approaches for different areas relevant to the user's prompt, structured around their requested analysis steps."),
  visualizationRecommendations: z.array(z.object({
    chartType: z.string().describe("Recommended type of chart or table for user's STEP 6 (e.g., 'Line Chart', 'Bar Chart', 'Stacked Bar Chart', 'Funnel Chart', 'Pivot Table Summary')."),
    description: z.string().describe("Description of what data this visualization should represent and what insight it might provide (e.g., 'Line chart displaying Monthly Revenue Trend per agent', 'Bar chart ranking Agents by Total Revenue Generated', 'Funnel chart showing drop-offs from Lead to Sale by Cohort').")
  })).min(2).describe("At least 2 recommendations for visualizations, mapping to user's STEP 6."),
  potentialDataIntegrityChecks: z.array(z.string()).min(2).describe("A list of at least 2 potential data integrity issues or checks the user should perform, mapping to user's STEP 7 (e.g., 'Verify call timestamps align with MIS reporting periods.', 'Check for duplicate lead IDs.', 'Ensure agent IDs are consistent.')."),
  strategicRecommendationsForUser: z.array(z.string()).min(2).describe("At least 2-3 high-level strategic recommendations that the user might derive *after* performing the analysis, based on the types of insights their data could yield (e.g., 'Focus on optimizing scripts for underperforming agents.', 'Reallocate budget to high-performing lead sources.', 'Develop retention strategies for high-churn cohorts.')."),
  topRevenueImprovementAreasToInvestigate: z.array(z.string()).min(2).max(3).describe("Suggest 2-3 top areas where the user's analysis (based on the provided strategy) is most likely to reveal opportunities for revenue improvement (e.g., 'Improving conversion rates of specific lead sources.', 'Reducing churn in key customer cohorts.', 'Optimizing agent pitch effectiveness for particular products or cohorts.')."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided: 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. This is distinct from the broader strategic playbook. E.g., 'The provided CSV sample shows an average call duration of X minutes.' or 'The sample text indicates a high frequency of the term Y.' If no sample, or sample is unusable, this field should reflect that."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer stating that this output is an AI-generated strategic guide for analysis. The AI has not directly processed or validated the content of complex binary files like Excel. The user is responsible for performing the actual data processing, calculations, and validation using appropriate tools."),
});
export type DataAnalysisStrategyOutput = z.infer<typeof DataAnalysisStrategyOutputSchema>;

// Exported function that UIs will call
export async function generateDataAnalysisStrategy(input: DataAnalysisStrategyInput): Promise<DataAnalysisStrategyOutput> {
  return dataAnalysisStrategyFlow(input);
}

const dataAnalysisStrategyPrompt = ai.definePrompt({
  name: 'dataAnalysisStrategyPrompt',
  input: {schema: DataAnalysisStrategyInputSchema},
  output: {schema: DataAnalysisStrategyOutputSchema},
  prompt: `You are a Senior Data Analyst and Business Strategy Consultant. Your primary role is to act as an expert advisor, generating a comprehensive, actionable "Strategic Analysis Playbook" to guide the user in analyzing their telecalling business data. Your output must be of a quality comparable to Gemini Pro, Julius AI, or ChatGPT-4o when tasked with data analysis strategy.

The user has provided:
1.  A detailed 'userAnalysisPrompt' describing their data files (e.g., Excel sheets like CDR Dump, Revenue by Agent, Cohort Funnel Breakdown, Monthly MIS reports for Oct-May), their likely structures, and a specific multi-step analysis plan they wish to execute.
2.  'fileDetails' (an array of file names and types) which provides context about the files they are working with.
3.  Optionally, 'sampledFileContent' (a small text snippet, ~10k chars, from the *first* CSV or TXT file provided in 'fileDetails').

**YOUR CORE TASK:**
Based on ALL the information, especially the user's detailed 'userAnalysisPrompt' and their outlined steps, generate the "Strategic Analysis Playbook" in the specified JSON format.

**CRITICAL INSTRUCTIONS FOR YOUR RESPONSE:**

*   **You CANNOT directly access or perform calculations on the internal content of the user's Excel files or other complex binary files (DOCX, PDF, ZIP).** Your guidance for these files must be based *solely* on the user's description of them, their names/types, and stated analytical goals.
*   **Your primary output is a STRATEGIC PLAYBOOK that the USER will implement using their own tools (e.g., Excel, Python, BI tools).**
*   **If 'sampledFileContent' IS PROVIDED (from a CSV/TXT file):**
    1.  **MANDATORY for 'directInsightsFromSampleText' field:** You MUST analyze THIS SAMPLE CONTENT to provide 2-3 CONCRETE, ACTIONABLE INSIGHTS, simple calculations (e.g., counts, averages IF clear numeric data is present in the sample), or key textual observations derived *DIRECTLY* from analyzing that sample. Prefix with "From the provided text sample:".
        *   Example of good insight from sample: "From the provided text sample: The 'call_duration' column in the sample shows an average of 180 seconds, with a few outliers exceeding 600 seconds. This suggests a need to investigate long calls."
        *   Example of BAD insight (avoid): "From the provided text sample: The sample contains columns for 'date', 'agent', 'duration'." (This is just listing, not insight).
        *   If the sample is genuinely too brief, noisy, or generic for meaningful numerical insights, provide qualitative observations or patterns.
        *   If absolutely no specific insight can be drawn from the sample, you MUST explicitly state: "The provided text sample was too brief or generic for specific direct insights, but it was considered for the overall playbook." Do NOT leave this field empty or omit it if a sample was provided to this prompt.
    2.  Use these sample-based insights to make your overall strategic playbook more tailored and concrete where appropriate, but the primary output is still the playbook.

**User's File Details (Names and Types):**
{{#each fileDetails}}
- File Name: "{{this.fileName}}", File Type: "{{this.fileType}}"
{{/each}}

**User's Detailed Analysis Prompt & Goals (This is the PRIMARY INPUT to guide your playbook structure):**
{{{userAnalysisPrompt}}}

{{#if sampledFileContent}}
**A small sample from one of the text-based files (e.g., CSV/TXT) has been provided for direct initial analysis:**
Sampled File Content (first ~10k chars):
\`\`\`
{{{sampledFileContent}}}
\`\`\`
You MUST analyze this specific sample content and provide direct observations in the 'directInsightsFromSampleText' field of your JSON output, as per critical instructions above.
{{/if}}


**STRATEGIC ANALYSIS PLAYBOOK SECTIONS TO GENERATE (Adhere to User's Multi-Step Plan):**

1.  **analysisTitle**: Create a concise, professional title (e.g., "Strategic Playbook for Telecalling Performance Analysis: Oct-May").

2.  **executiveSummary**: Provide bullet points summarizing:
    *   The overall strategic approach to analyzing the described data to achieve the user's multi-step plan.
    *   The types of high-level business insights the user should aim to uncover by following this playbook.

3.  **dataUnderstandingAndPreparationGuide**: This section corresponds to **USER'S STEP 1 (Clean & Prepare Data)**.
    *   For each *type* of file described by the user (e.g., "CDR Dump", "Monthly MIS", "Revenue by Agent", "Cohort Funnel Breakdown"), suggest:
        *   Typical key columns and data structures relevant to telecalling that might be present.
        *   Hypothesize potential sheet names if Excel files are mentioned (e.g., "Agent Performance Oct", "Call Logs Q4").
    *   Provide actionable advice on data cleaning and preparation based on the user's prompt:
        *   Standardizing column names (e.g., "ensure 'AgentID' is consistent, convert 'call date' to 'call_date'").
        *   Ensuring numeric fields (conversion %, revenue, calls) are correctly typed as numbers. Strategies for handling text like "N/A" or blanks in numeric fields.
        *   Strategies for handling missing values (e.g., imputation for some fields, removal for others, based on context).
        *   Parsing date/time fields consistently (e.g., "ensure 'CallTime' is parsed to a datetime object, 'Month' from MIS sheet names should be standardized to 'YYYY-MM' format").
        *   Guidance on adding a 'Month' column if needed (e.g., deriving from sheet names in MIS files or file names if MIS are monthly).
    *   If 'sampledFileContent' was provided, incorporate observations from it (e.g., "The sample CSV shows dates in 'dd/mm/yyyy' format, ensure this is parsed correctly.") to make data prep guidance more specific.

4.  **keyMetricsAndKPIsToFocusOn**: This section helps set up for **USER'S STEP 2 (Metric Calculations)**.
    *   List the critical metrics and KPIs the user has asked to calculate (e.g., agent-wise conversion_rate, connected_rate, AOV; cohort-wise conversion %, connected %, revenue_per_lead).
    *   For each KPI, briefly explain *why* it's important in the context of the user's likely business goals (e.g., "Agent Conversion Rate directly measures sales effectiveness per interaction.").

5.  **suggestedAnalyticalSteps**: This is a CRITICAL section. Structure this as an array of objects, where each object represents a major analytical area from the user's request (Steps 2 through 4, and step for issue flagging if mentioned).
    *   **Area: Metric Calculation Guidance (Corresponds to user's STEP 2)**
        *   **Steps**: Provide detailed guidance on *how* the user can approach calculating the metrics mentioned in \`keyMetricsAndKPIsToFocusOn\`.
            *   For Agent × Month: Explain the formulas (e.g., \`conversion_rate = conversions / connected_calls\`). Advise on handling division by zero for AOV (e.g., "return 0 or null if conversions are zero"). Specify which files likely contain 'conversions', 'connected_calls', 'revenue' (e.g., "Revenue by Agent sheet for revenue, MIS for call data").
            *   For Cohort × Month: Explain how to aggregate total leads, connected leads, converted leads from likely sources (e.g., "Cohort Funnel Breakdown sheet"). Then, guide on calculating cohort-specific conversion %, connected %, and revenue per lead.
    *   **Area: Trend Analysis (Corresponds to user's STEP 3)**
        *   **Steps**: Guide the user on:
            *   Aggregating and plotting monthly revenue trends per agent (Oct-May). Which columns to use from "Revenue by Agent".
            *   Tracking monthly conversion % changes per cohort. Which columns/sheets to use.
            *   Methods to identify and flag significant drops (e.g., "Calculate MoM percentage change. Flag if change < -25%.").
            *   Techniques for ranking top 3 and bottom 3 agents by revenue each month (e.g., "Use Excel's RANK or sort functions within each month's data.").
    *   **Area: Lead & Agent Performance Deep Dive (Corresponds to user's STEP 3, expanded)**
        *   **Steps**: Provide guidance on how to correlate agent conversion % and revenue across months. How to compare call connectivity (from CDR or MIS), conversion efficiency, and AOV. How to systematically flag underperforming and outperforming agents with justification criteria (e.g., "Agents consistently in bottom quartile for conversion AND revenue for 2+ months need attention.").
    *   **Area: Funnel Drop-off Analysis (Corresponds to user's STEP 4)**
        *   **Steps**: Advise on:
            *   How to structure data to track leads through the funnel stages (Plan Page, Paywall, Payment Drop-off, etc.) for each cohort, likely using "Cohort Funnel Breakdown".
            *   Calculating the number of leads, calls, conversions, total revenue, and average revenue per converted lead at each stage for each cohort.
    *   **Area: Attribution & Campaign Effectiveness (Corresponds to user's STEP 5)**
        *   **Steps**: Provide guidance on:
            *   Strategies for matching leads to source campaigns (e.g., "Join 'Source Data Dump' with 'CDR' or 'Revenue' sheets using a common Lead ID. Look for UTM parameters or lead source fields.").
            *   Calculating ROI (if campaign cost data is available or can be estimated by the user) and response time vs. conversion (if lead timestamp and conversion timestamp are available).
            *   Identifying underutilized high-performing sources (e.g., "Sources with high conversion % but low lead volume.").
    *   **Area: Insight Generation & Issue Flagging (Corresponds to user's issue flagging step, e.g., STEP 7 in example)**
        *   **Steps**: Guide on how to systematically:
            *   Flag agents with consistent performance drops (e.g., "Track agent conversion % MoM. If it declines for >2 consecutive months, flag.").
            *   Identify cohorts with contact % < 30% (e.g., "From Cohort Funnel data, calculate (connected_calls / total_leads) for each cohort. Flag if < 0.3.").
            *   Determine the most and least profitable cohorts (e.g., "Compare total revenue per cohort against total leads per cohort, or cost per lead if available.").
            *   Suggest methods to identify potential data integrity problems (e.g., "Cross-check total calls in CDR with MIS. Look for agent IDs in Revenue sheet not present in MIS. Check for duplicate Lead IDs across 'Source Data Dump' and conversion tables.").
            *   Advise on how to raise red flags on performance anomalies or potential revenue leakages discovered through the above analyses.

6.  **visualizationRecommendations**: This section corresponds to **USER'S STEP for Visualizations (e.g., STEP 6 in example)**.
    *   Recommend specific chart types for the requested visualizations:
        *   Line chart: Revenue per agent across months. (Suggest "Agent Name" for series, "Month" for X-axis, "Total Revenue" for Y-axis).
        *   Bar chart: Conversion % by cohort for each month. (Suggest "Cohort" for X-axis groups, "Month" for series or faceted, "Conversion %" for Y-axis).
        *   Table: Agent-wise performance summary (Month, Calls, Connected %, Conversion %, Revenue, AOV). (Suggest clear column headers).
    *   Suggest other relevant visualizations for funnel health (e.g., "Funnel chart showing drop-offs at each stage for key cohorts.").
    *   Include actionable takeaways the user should look for from each insight cluster/visualization.

7.  **potentialDataIntegrityChecks**: (Can be part of "Insight Generation & Issue Flagging" or standalone). List specific data integrity checks relevant to the user's described files and goals (e.g., "Verify all agent IDs in 'Revenue by Agent' exist in a master agent list if available.", "Check for calls in CDR with zero duration that might indicate connection issues.").

8.  **strategicRecommendationsForUser**: Based on the *potential* insights the user might find by following your playbook (especially from their issue flagging step and overall analysis), suggest 2-3 high-level, actionable strategic business recommendations (e.g., "If analysis shows Cohort X has high conversion but low volume, consider increasing marketing spend for that source.", "If Agent Y consistently underperforms, recommend targeted retraining or script optimization.").

9.  **topRevenueImprovementAreasToInvestigate**: Based on common telecalling business scenarios and the user's described data/goals, identify 2-3 top areas where their detailed analysis (guided by this playbook) is most likely to reveal significant opportunities for revenue improvement (e.g., "Optimizing conversion rates for the 'Paywall Dropoff' cohort.", "Improving agent effectiveness in handling objections related to 'Price'.", "Targeting campaigns more effectively towards historically high-performing lead sources.").

10. **directInsightsFromSampleText**:
    {{#if sampledFileContent}}
    (MANDATORY if 'sampledFileContent' was provided) Provide 2-3 brief, CONCRETE insights, simple calculations (e.g., counts, averages if numeric data is present), or key textual observations derived *DIRECTLY* from analyzing the 'sampledFileContent' above. Prefix with "From the provided text sample:".
    If the sample is too brief or generic for meaningful numerical insights, provide qualitative observations. If absolutely no specific insight can be drawn, you MUST explicitly state: "The provided text sample was too brief or generic for specific direct insights, but it was considered for the overall playbook." Do NOT leave this field empty or omit it if a sample was provided to this prompt.
    {{else}}
    (This field should be omitted or null if no 'sampledFileContent' was provided as input to this prompt)
    {{/if}}

11. **limitationsAndDisclaimer**: CRITICAL: Clearly state: "This output is an AI-generated strategic playbook to guide your data analysis. The AI has NOT directly processed, validated, or performed calculations on the internal content of complex binary files (Excel, DOCX, PDF, ZIP). For CSV/TXT files, only a small sample may have been analyzed for the 'directInsightsFromSampleText' section. You are responsible for implementing the actual data processing, calculations, and validation using appropriate tools (like Excel, Python, or BI software) on your full datasets. Always critically evaluate the AI's suggestions against your actual data and business context."

Ensure the entire output is well-structured, professional, and provides genuinely helpful, expert-level guidance for a telecalling business context, following the user's multi-step plan.
Output the entire response in the specified JSON format.
`
});

const dataAnalysisStrategyFlow = ai.defineFlow(
  {
    name: 'dataAnalysisStrategyFlow',
    inputSchema: DataAnalysisStrategyInputSchema,
    outputSchema: DataAnalysisStrategyOutputSchema,
  },
  async (input: DataAnalysisStrategyInput): Promise<DataAnalysisStrategyOutput> => {

    const {output} = await dataAnalysisStrategyPrompt(input);

    if (!output) {
      console.error("Data analysis strategy flow: Prompt returned null output for input:", input.userAnalysisPrompt);
      // Return a structured error object matching the output schema
      return {
        analysisTitle: `Error Generating Analysis Strategy`,
        executiveSummary: "The AI failed to generate an executive summary for the analysis strategy.",
        dataUnderstandingAndPreparationGuide: "AI failed to provide guidance on data understanding and preparation.",
        keyMetricsAndKPIsToFocusOn: ["AI failed to suggest KPIs."],
        suggestedAnalyticalSteps: [{ area: "Error", steps: "AI failed to generate analytical steps." }],
        visualizationRecommendations: [{ chartType: "Error", description: "AI failed to recommend visualizations." }],
        potentialDataIntegrityChecks: ["AI failed to suggest data integrity checks."],
        strategicRecommendationsForUser: ["AI failed to provide strategic recommendations."],
        topRevenueImprovementAreasToInvestigate: ["AI failed to identify revenue improvement areas."],
        limitationsAndDisclaimer: "The AI analysis strategy generation process encountered an error. Please try again. This output is not a valid analysis strategy.",
        directInsightsFromSampleText: input.sampledFileContent ? "AI failed to process the sample content for direct insights." : undefined,
      };
    }

    // Ensure mandatory fields have some fallback if AI misses them, though the prompt is strict.
    output.analysisTitle = output.analysisTitle || "Comprehensive Analysis Strategy";
    output.limitationsAndDisclaimer = output.limitationsAndDisclaimer || "This is an AI-generated strategic guide. The AI has not directly processed binary file content (Excel etc.). For CSV/TXT, only a sample may have been used for direct insights. User is responsible for actual data processing and validation.";
    if (!output.executiveSummary) output.executiveSummary = "No executive summary generated.";
    if (!output.dataUnderstandingAndPreparationGuide) output.dataUnderstandingAndPreparationGuide = "No data preparation guide generated.";
    if (!output.keyMetricsAndKPIsToFocusOn || output.keyMetricsAndKPIsToFocusOn.length === 0) output.keyMetricsAndKPIsToFocusOn = ["No specific KPIs suggested."];
    if (!output.suggestedAnalyticalSteps || output.suggestedAnalyticalSteps.length === 0) output.suggestedAnalyticalSteps = [{area: "General Analysis", steps: "No specific analytical steps suggested."}];

    // Specific fallback for directInsightsFromSampleText if a sample was provided but AI didn't fill it
    if (input.sampledFileContent && (!output.directInsightsFromSampleText || output.directInsightsFromSampleText.trim() === "")) {
        output.directInsightsFromSampleText = "The AI was instructed to analyze the provided text sample but did not return specific direct insights. It might have found the sample too brief or generic, but it was considered for the overall playbook.";
    }


    return output;
  }
);

// Renaming the main exported function for clarity, if this file is solely for strategy.
// If it still needs to handle the old direct analysis, the naming and logic would be more complex.
// For now, assuming it's fully shifted to strategy generation.
export const analyzeData = generateDataAnalysisStrategy;
export type DataAnalysisInput = DataAnalysisStrategyInput;
export type DataAnalysisOutput = DataAnalysisStrategyOutput;
    

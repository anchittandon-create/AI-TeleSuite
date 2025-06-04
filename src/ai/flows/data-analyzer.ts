
'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis.
 * This AI acts as an expert data analyst. It takes a detailed user prompt describing their data files (Excel, CSV, etc.),
 * their likely structure, and their specific analytical goals. It then performs the analysis based on a comprehensive
 * internal prompt and outputs a structured report.
 *
 * If a small sample of a text-based file (CSV/TXT) is provided via the input, the AI will also attempt
 * to derive direct, concrete insights from that sample, in addition to the main analysis.
 *
 * The AI does NOT directly process or perform calculations on the internal content of large binary files like Excel.
 * Its analysis is based on the user's descriptions, file metadata, and any provided text samples.
 *
 * - analyzeData - A function that generates an analysis report.
 * - DataAnalysisInput - The input type for the function.
 * - DataAnalysisReportOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DataAnalysisInputSchema = z.object({
  fileDetails: z.array(z.object({
    fileName: z.string().describe("The name of one of the user's files."),
    fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').")
  })).min(1).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May containing columns: Agent Name, Calls Made, Revenue...', 'CDR Dump as ZIP of CSVs...'), their likely data structure (column headers, date formats, numeric vs categorical fields, AND CRITICALLY: any decoding rules for coded fields e.g., 'NR' = Not Reachable, 'CALLB' = Call Back, 'INT' = Interested), specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions and is CRITICAL for the AI to understand the data it cannot directly read.").max(10000),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

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

const DataAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("A comprehensive title for this specific data analysis report, reflecting the user's file context and analysis goals (e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)', 'Subscription Renewal Rate Analysis')."),
  executiveSummary: z.string().min(1).describe("A concise overview (2-3 bullet points or a short paragraph) of the most critical findings and actionable insights. This should explain what the data *means* at a high level."),
  keyMetrics: z.array(KeyMetricSchema).min(1).describe("An array of at least 1-3 key metrics or KPIs derived from the analysis (e.g., Conversion Rate, Lead Follow-up Rate, Connection Rate, Avg Revenue/Call). These should be specific and, where possible, quantified based on the user's description of their data. If revenue is missing, state how performance is being inferred (e.g., from intent outcome distribution)."),
  detailedAnalysis: z.object({
    timeSeriesTrends: z.string().optional().describe("Analysis of time-based trends (e.g., monthly/quarterly growth, dips, seasonality in revenue, calls, conversions, connection rates). Describe what patterns are observed and potential reasons based on described data context. Highlight any significant monthly changes."),
    comparativePerformance: z.string().optional().describe("Comparison of performance across different categories such as agents or cohorts. Identify top/low performers or significant variances. For agents, discuss insights like 'Agent A converted fewer leads despite high talktime'. For cohorts, identify which ones are being ignored or over-performing, and their ROI if inferable."),
    useCaseSpecificInsights: z.string().optional().describe("Insights specific to telecalling operations, campaign attribution, incentive effectiveness, or sales funnel leakages, as suggested by the user's prompt and data description. Examples: insights on lead connectivity, conversion rates at different funnel stages, agent productivity variations, cohort ROI, incentive impact, or reasons for low follow-up causing low conversions. If something seems off (e.g., very low call duration based on user's description), flag it as a red flag and suggest possible causes."),
  }).describe("Detailed breakdown of analytical findings, covering agent-level insights, cohort trends, and other use-case specific points."),
  chartsOrTablesSuggestions: z.array(ChartTableSuggestionSchema).optional().describe("Suggestions for 1-2 charts or tables that would best visualize the key findings. Describe the type, title, and data it would use from the user's described files."),
  recommendations: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Agent Training, Cohort Strategy, Lead Management, Process Improvement, Incentive Adjustment)."),
    recommendation: z.string().describe("A specific, actionable recommendation based on the analysis (e.g., 'Train low-performing agents on X', 'Focus more on Payment Drop-offs cohort due to high ROI potential')."),
    justification: z.string().optional().describe("Briefly mention the analysis findings or data patterns (from user's description) that support this recommendation.")
  })).min(1).describe("At least 1-2 actionable recommendations or next steps derived from the analysis."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided: 2-3 specific insights, simple calculations (e.g. 'Average X from sample is Y'), or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes based on a 'Duration' column.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;

const dataAnalysisReportPrompt = ai.definePrompt({
  name: 'dataAnalysisReportPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisReportSchema},
  prompt: `You are a powerful AI data analyst, specializing in business operations, particularly telesales and subscription models. Your task is to analyze operational datasets (described by the user, potentially from CSV/Excel) and extract meaningful insights, KPIs, and trends. Your job is NOT to just describe what's in the file descriptions; your job is to explain what the data *means*.

User's File Context (Names & Types ONLY - you will NOT see the content of binary files like Excel/PDF):
{{#each fileDetails}}
- File Name: {{fileName}} (Type: {{fileType}})
{{/each}}

CRITICAL: User's Detailed Data Description & Analysis Prompt:
This is your PRIMARY source of information about the data structure, contents, specific file mappings, decoding rules for coded fields, and the user's analytical goals for this run.
"""
{{{userAnalysisPrompt}}}
"""

{{#if sampledFileContent}}
Small Sampled Text Content (from FIRST provided CSV/TXT file ONLY, use for direct initial observations if any):
"""
{{{sampledFileContent}}}
"""
{{/if}}

Your Analytical Process (Simulated based on User's Description):
Based *solely* on the user's "Detailed Data Description & Analysis Prompt" and the "File Context" (and "Sampled Text Content" if available), generate a comprehensive analysis report. You will act as if you have performed the following steps on the data as described by the user:

1.  **Understand the Dataset (from User's Description):**
    *   Identify important columns mentioned by the user (e.g., agent name, call status, timestamps, lead ID, cohort name, revenue, duration).
    *   If the user describes coded fields (e.g., 'NR' = Not Reachable, 'CALLB' = Call Back), use the decoding rules *they provide in their prompt*. If rules are missing but coded fields are implied, make a reasonable assumption and state it, or note that decoding rules are needed for full accuracy.

2.  **Preprocess for Analysis (Simulated based on User's Description):**
    *   Assume normalization of column names and date fields as per user's description.
    *   Assume removal of irrelevant rows (empty, repeated headers, summaries) if user's description implies such data.
    *   Assume appropriate handling of missing values (e.g., ignore, fill with mean/median if user implies this type of data).
    *   Assume logical grouping of related outcomes if the user describes them (e.g., 'INT', 'CALLB', 'B' = positive intent signals).

3.  **Calculate Key KPIs (Based on User's Description and Stated Formulas):**
    If the user's data description suggests the necessary columns, calculate or explain how to calculate relevant KPIs. Use these definitions if applicable:
    *   **Conversion Rate** = (Interested + Subscribed outcomes) / (Total leads or Total calls described)
    *   **Lead Follow-up Rate** = (# of CALLB or follow-up attempts described) / (Total Leads described)
    *   **Average Revenue per Call** = (Total Revenue described) / (Total Connected Calls described)
    *   **Connection Rate** = (# Connected outcomes like 'INT', 'CALLB', 'ALREAD' described) / (Total Calls described)
    *   If revenue is missing, state that you are inferring performance using proxy indicators like intent outcome distribution based on the user's description. Quantify where possible.

4.  **Trend & Comparison Logic (Based on User's Description):**
    *   Compare KPIs across agents, cohorts, or months *as described by the user*.
    *   Highlight best and worst performers *if the user's data description allows such an inference*.
    *   Detect if low follow-up (described by user) is causing low conversions (described by user).
    *   Identify which cohorts (e.g., Payment Drop-off) are being ignored or over-performed *based on user's description*.

5.  **Insightful Output & Structure (Strictly adhere to 'DataAnalysisReportSchema'):**
    *   **reportTitle**: A comprehensive title.
    *   **executiveSummary**: Critical findings. Explain what the data *means*.
    *   **directInsightsFromSampleText (if applicable)**: 2-3 specific insights *directly* from 'sampledFileContent'.
    *   **keyMetrics**: Quantified KPIs with brief insights, using the definitions above if the user's data description supports them.
    *   **detailedAnalysis**:
        *   \`timeSeriesTrends\`: Monthly/quarterly trends, spikes, dips.
        *   \`comparativePerformance\`: Agent-level insights (e.g., "Agent A converted fewer leads despite high talktime — possible inefficiency, based on user's description of 'Conversion' and 'Talktime' columns.") and Cohort trends (e.g., "Payment Drop-off cohort shows high ROI potential but low follow-up based on described 'ROI' and 'Follow-up_Attempts' columns.").
        *   \`useCaseSpecificInsights\`: Insights on telesales operations, funnels, incentives. Be proactive: if something seems off (e.g., very low call duration, based on user's description), flag it as a red flag and suggest possible causes.
    *   **chartsOrTablesSuggestions (Optional)**: 1-2 suggestions.
    *   **recommendations**: Actionable next steps (e.g., "Train low-performing agents on X technique, assuming 'Agent_Performance' data shows variance," "Focus more on Payment Drop-offs cohort, assuming cohort data shows this trend.").
    *   **limitationsAndDisclaimer**: CRITICALLY IMPORTANT - Always include the standard disclaimer: "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."

Guiding Principles:
*   **Interpret, Don't Just Describe**: Explain what the data *means* for the business.
*   **Specificity**: Provide actual numbers and specific examples where possible, *based on the user's textual description and sample data*.
*   **Relevance**: Focus on telesales and subscription operations if user context implies it.
*   **Actionable**: Recommendations should be practical.
*   **Based on User's Text**: Your entire analysis is constrained by the textual information provided by the user. Do not invent data or structures not described.
*   **Assume User Description is Accurate**: Trust the user's prompt about their data's structure and content for your analysis.

If the user's prompt is insufficient to perform a section of the analysis meaningfully, state that clearly (e.g., "Time-series trend analysis cannot be performed as date information or relevant metrics were not described in the prompt."). Do NOT ask follow-up questions. Generate the best possible report based on the information given.
`,
  model: 'googleai/gemini-2.0-flash', // Using a powerful model for this complex task
  config: {
    temperature: 0.3, // Lower temperature for more factual and consistent analysis
  }
});

const dataAnalysisReportFlow = ai.defineFlow(
  {
    name: 'dataAnalysisReportFlow',
    inputSchema: DataAnalysisInputSchema,
    outputSchema: DataAnalysisReportSchema,
  },
  async (input: DataAnalysisInput): Promise<DataAnalysisReportOutput> => {
    const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context.";
    try {
      if (!input.userAnalysisPrompt || input.userAnalysisPrompt.length < 50) {
        return {
            reportTitle: "Data Analysis Not Performed",
            executiveSummary: "The user's analysis prompt was too short or missing. Please provide a detailed description of your data and analysis goals.",
            keyMetrics: [],
            detailedAnalysis: {},
            recommendations: [{ area: "Input", recommendation: "Provide a more detailed analysis prompt.", justification: "Prompt was insufficient." }],
            limitationsAndDisclaimer: `Analysis not performed due to insufficient input. ${defaultDisclaimer}`,
        };
      }

      const {output} = await dataAnalysisReportPrompt(input);
      if (!output) {
        throw new Error("AI failed to generate data analysis report.");
      }
      // Ensure the disclaimer is always present, even if the AI somehow misses it.
      if (!output.limitationsAndDisclaimer || !output.limitationsAndDisclaimer.includes("NOT directly processed")) {
          output.limitationsAndDisclaimer = defaultDisclaimer;
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in dataAnalysisReportFlow:", error);
      // Fallback structure for errors, ensuring all required fields of DataAnalysisReportSchema are present
      return {
        reportTitle: "Data Analysis Failed",
        executiveSummary: `Error: ${error.message}. Ensure Google API Key is valid. The AI could not process your request.`,
        keyMetrics: [{metricName: "Error", value:"N/A", insight: "Analysis failed."}],
        detailedAnalysis: {
            timeSeriesTrends: "Analysis unavailable due to error.",
            comparativePerformance: "Analysis unavailable due to error.",
            useCaseSpecificInsights: "Analysis unavailable due to error."
        },
        chartsOrTablesSuggestions: [],
        recommendations: [{ area: "System Error", recommendation: `Analysis failed: ${error.message}`, justification: "AI service error." }],
        directInsightsFromSampleText: input.sampledFileContent ? "Sample not processed due to error." : undefined,
        limitationsAndDisclaimer: `Error occurred during analysis. ${defaultDisclaimer}`,
      };
    }
  }
);

export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisReportOutput> {
  const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context.";
  try {
    return await dataAnalysisReportFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling dataAnalysisReportFlow:", error);
    // Fallback structure for catastrophic errors
    return {
        reportTitle: "Critical System Error in Data Analysis",
        executiveSummary: `A server-side error occurred: ${error.message}. Please check server logs.`,
        keyMetrics: [{metricName: "System Error", value:"N/A", insight: "Critical failure."}],
        detailedAnalysis: {
            timeSeriesTrends: "Analysis unavailable due to critical system error.",
            comparativePerformance: "Analysis unavailable due to critical system error.",
            useCaseSpecificInsights: "Analysis unavailable due to critical system error."
        },
        chartsOrTablesSuggestions: [],
        recommendations: [{ area: "System Error", recommendation: `Critical failure: ${error.message}`, justification: "System error." }],
        directInsightsFromSampleText: input.sampledFileContent ? "Sample not processed due to critical error." : undefined,
        limitationsAndDisclaimer: `Critical error occurred. ${defaultDisclaimer}`,
    };
  }
}


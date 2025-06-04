
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
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May containing columns: Agent Name, Calls Made, Revenue...', 'CDR Dump as ZIP of CSVs...'), their likely data structure (column headers, date formats, numeric vs categorical fields), specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions and is CRITICAL for the AI to understand the data it cannot directly read.").max(10000),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const KeyMetricSchema = z.object({
  metricName: z.string().describe("Name of the Key Performance Indicator (KPI) or key metric identified (e.g., 'Overall Conversion Rate', 'Average Revenue Per Call', 'Lead Follow-up Rate', 'Connectivity %')."),
  value: z.string().describe("The calculated or inferred value of the metric (e.g., '15.2%', '₹350', '75%', '60%'). State if value cannot be determined from provided context."),
  trendOrComparison: z.string().optional().describe("Brief note on trend (e.g., 'Up 5% from last month', 'Stable') or comparison ('Highest among agents') if derivable."),
  insight: z.string().optional().describe("A brief insight related to this metric. (e.g. 'Indicates strong product-market fit for this cohort.')")
});

const ChartTableSuggestionSchema = z.object({
  type: z.enum(["Line Chart", "Bar Chart", "Pie Chart", "Table", "Heatmap", "Scatter Plot"]).describe("Suggested type of visualization."),
  title: z.string().describe("Title for the suggested chart/table (e.g., 'Monthly Revenue Trend', 'Agent Performance Comparison')."),
  description: z.string().describe("Brief description of what this chart/table would show and what data it would use from the user's described files (e.g., 'Line chart showing total revenue per month from Oct-May, using 'Revenue' column from ET MIS sheets.' or 'Table comparing Agent Name, Calls Made, Conversion %').")
});

const DataAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("A comprehensive title for this specific data analysis report, reflecting the user's file context and analysis goals (e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)')."),
  executiveSummary: z.string().min(1).describe("A concise overview (2-3 bullet points or a short paragraph) of the most critical findings and actionable insights. This should explain what the data *means* at a high level."),
  keyMetrics: z.array(KeyMetricSchema).min(1).describe("An array of at least 1-3 key metrics or KPIs derived from the analysis. These should be specific and, where possible, quantified based on the user's description of their data."),
  detailedAnalysis: z.object({
    timeSeriesTrends: z.string().optional().describe("Analysis of time-based trends (e.g., monthly/quarterly growth, dips, seasonality in revenue, calls, conversions). Describe what patterns are observed and potential reasons based on described data context."),
    comparativePerformance: z.string().optional().describe("Comparison of performance across different categories (e.g., agents, campaigns, products, cohorts). Identify top/low performers or significant variances."),
    useCaseSpecificInsights: z.string().optional().describe("Insights specific to telecalling operations, campaign attribution, incentive effectiveness, or sales funnel leakages, as suggested by the user's prompt and data description. For example, insights on lead connectivity, conversion rates at different funnel stages, agent productivity variations, cohort ROI, or incentive impact."),
  }).describe("Detailed breakdown of analytical findings."),
  chartsOrTablesSuggestions: z.array(ChartTableSuggestionSchema).optional().describe("Suggestions for 1-2 charts or tables that would best visualize the key findings. Describe the type, title, and data it would represent."),
  recommendations: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Lead Management, Agent Training, Campaign Strategy, Incentive Adjustment, Process Improvement)."),
    recommendation: z.string().describe("A specific, actionable recommendation based on the analysis."),
    justification: z.string().optional().describe("Briefly mention the analysis findings or data patterns (from user's description) that support this recommendation.")
  })).min(1).describe("At least 1-2 actionable recommendations derived from the analysis."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided: 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;

const dataAnalysisReportPrompt = ai.definePrompt({
  name: 'dataAnalysisReportPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisReportSchema},
  prompt: `You are a powerful AI data analyst. Your mission is to analyze business data based on user-provided descriptions and extract meaningful, actionable insights. You do not just describe contents; you interpret what the data *means*.

User's File Context (Names & Types ONLY - you will NOT see the content of binary files like Excel/PDF):
{{#each fileDetails}}
- File Name: {{fileName}} (Type: {{fileType}})
{{/each}}

CRITICAL: User's Detailed Data Description & Analysis Prompt:
This is your PRIMARY source of information about the data structure, contents, and goals.
"""
{{{userAnalysisPrompt}}}
"""

{{#if sampledFileContent}}
Small Sampled Text Content (from FIRST provided CSV/TXT file ONLY, use for direct initial observations, if any):
"""
{{{sampledFileContent}}}
"""
{{/if}}

Your Task:
Based *solely* on the user's "Detailed Data Description & Analysis Prompt" and the "File Context" (and "Sampled Text Content" if available), generate a comprehensive analysis report.
Act as if you have performed the following steps on the data as described by the user:
1.  **Understood File Structure**: Classified sheets, identified headers, date formats, numeric/categorical fields as per user's description.
2.  **Cleaned & Preprocessed**: Assumed normalization of headers/dates, removal of irrelevant rows, and appropriate handling of missing values, all guided by the user's prompt.
3.  **Analyzed for Patterns & Trends**: Identified time-series trends, compared performance across categories, and calculated KPIs, all based on the user's description of what data is available and where.
4.  **Applied Business Logic Awareness**: Leveraged understanding of telesales, campaign attribution, incentive effectiveness, and sales funnels, as relevant to the user's prompt.

Output Structure (Strictly adhere to the 'DataAnalysisReportSchema'):
1.  **Report Title**: A comprehensive title reflecting the analysis.
2.  **Executive Summary**: Critical findings and actionable insights. Explain what the data *means*.
3.  **Direct Insights from Sampled Text (if applicable)**: 2-3 specific insights or simple calculations *directly* from the 'sampledFileContent' if provided and usable. Otherwise, state it's not applicable.
4.  **Key Metrics**: 1-3 key metrics/KPIs derived from the analysis (e.g., Conversion Rate, Avg Revenue/Call). Quantify if possible based on user's description.
5.  **Detailed Analysis**:
    *   \\\`timeSeriesTrends\\\`: Discuss monthly/quarterly trends, spikes, dips in key metrics.
    *   \\\`comparativePerformance\\\`: Compare agents, campaigns, cohorts, etc.
    *   \\\`useCaseSpecificInsights\\\`: Insights related to telesales, funnels, incentives as per user's focus.
6.  **Charts or Tables Suggestions (Optional)**: 1-2 suggestions for visualizations (type, title, data it would use from user's described files).
7.  **Recommendations**: 1-2 specific, actionable recommendations with justification based on the analysis of the described data.
8.  **Limitations and Disclaimer**: CRITICALLY IMPORTANT - Include the standard disclaimer: "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."

Guiding Principles:
*   **Insight-Driven**: Focus on what the data *means* for the business, not just what columns are present.
*   **Business Relevancy**: Ensure analysis is relevant to common business objectives.
*   **Actionable**: Recommendations should be practical.
*   **Based on User's Text**: Your entire analysis is constrained by the textual information provided by the user. If they describe a column named 'Revenue' in 'Sheet1' of 'sales.xlsx', you work with that assumption. Do not invent data or structures not described.
*   **Clarity**: Present findings clearly and concisely.
*   **Assume User Description is Accurate**: Trust the user's prompt about their data's structure and content for your analysis.

If the user's prompt is insufficient to perform a section of the analysis meaningfully, state that clearly (e.g., "Time-series trend analysis cannot be performed as date information or relevant metrics were not described in the prompt.").
Do NOT ask follow-up questions. Generate the best possible report based on the information given.
`,
  model: 'googleai/gemini-2.0-flash',
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
      return {
        reportTitle: "Data Analysis Failed",
        executiveSummary: `Error: ${error.message}. Ensure Google API Key is valid. The AI could not process your request.`,
        keyMetrics: [{metricName: "Error", value:"N/A", insight: "Analysis failed."}],
        detailedAnalysis: {
            timeSeriesTrends: "Analysis unavailable due to error.",
            comparativePerformance: "Analysis unavailable due to error.",
            useCaseSpecificInsights: "Analysis unavailable due to error."
        },
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
    return {
        reportTitle: "Critical System Error in Data Analysis",
        executiveSummary: `A server-side error occurred: ${error.message}. Please check server logs.`,
        keyMetrics: [{metricName: "System Error", value:"N/A", insight: "Critical failure."}],
        detailedAnalysis: {
            timeSeriesTrends: "Analysis unavailable due to critical system error.",
            comparativePerformance: "Analysis unavailable due to critical system error.",
            useCaseSpecificInsights: "Analysis unavailable due to critical system error."
        },
        recommendations: [{ area: "System Error", recommendation: `Critical failure: ${error.message}`, justification: "System error." }],
        directInsightsFromSampleText: input.sampledFileContent ? "Sample not processed due to critical error." : undefined,
        limitationsAndDisclaimer: `Critical error occurred. ${defaultDisclaimer}`,
    };
  }
}


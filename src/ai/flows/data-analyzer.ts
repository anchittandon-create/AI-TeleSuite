
'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis.
 * This AI acts as an expert data analyst. It takes a detailed user prompt describing their data files (Excel, CSV, etc.),
 * their likely structure (including potential messiness), and their specific analytical goals. It then performs the analysis based on a comprehensive
 * internal prompt and outputs a structured report, simulating advanced data cleaning and interpretation.
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
import {z} from 'zod';

const DataAnalysisInputSchema = z.object({
  fileDetails: z.array(z.object({
    fileName: z.string().describe("The name of one of the user's files."),
    fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').")
  })).min(1).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May containing columns: Agent Name, Calls Made, Revenue...', 'CDR Dump as ZIP of CSVs...'), their likely data structure (column headers, date formats, numeric vs categorical fields, AND CRITICALLY: any decoding rules for coded fields e.g., 'NR' = Not Reachable, 'CALLB' = Call Back, 'INT' = Interested), specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions and is CRITICAL for the AI to understand the data it cannot directly read. Describe any known messiness in the data if you want the AI to address hypothetical cleaning steps.").max(10000),
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
    dataReconstructionAndNormalizationSummary: z.string().optional().describe("A brief summary of how the AI *hypothetically* cleaned, reconstructed, or normalized the data tables based on the user's description of the data and its potential messiness. Explicitly mention how the user's detailed prompt (e.g., descriptions of column misalignments, merged rows, or specific null value representations) guided this simulated cleanup process."),
    smartTableRecognitionSummary: z.string().optional().describe("Brief summary of how the AI *inferred* the purpose of different described data tables/sheets (e.g., CDR, Daily MIS, Source Dump) based on the column names, sheet names, and context provided by the user in their detailed prompt."),
    timeSeriesTrends: z.string().optional().describe("Analysis of time-based trends (e.g., monthly/quarterly growth, dips, seasonality in revenue, calls, conversions, connection rates). Describe what patterns are observed and potential reasons based on described data context. Highlight any significant monthly changes."),
    comparativePerformance: z.string().optional().describe("Comparison of performance across different categories such as agents or cohorts. Identify top/low performers or significant variances. For agents, discuss insights like 'Agent A converted fewer leads despite high talktime'. For cohorts, identify which ones are being ignored or over-performing, and their ROI if inferable."),
    useCaseSpecificInsights: z.string().optional().describe("Insights specific to telecalling operations, campaign attribution, incentive effectiveness, or sales funnel leakages, as suggested by the user's prompt and data description. Examples: insights on lead connectivity, conversion rates at different funnel stages, agent productivity variations, cohort ROI, incentive impact, or reasons for low follow-up causing low conversions. If something seems off (e.g., very low call duration based on user's description), flag it as a red flag and suggest possible causes."),
  }).describe("Detailed breakdown of analytical findings, covering hypothetical data prep, table interpretations, agent-level insights, cohort trends, and other use-case specific points."),
  chartsOrTablesSuggestions: z.array(ChartTableSuggestionSchema).optional().describe("Suggestions for 1-2 charts or tables that would best visualize the key findings. Describe the type, title, and data it would use from the user's described files."),
  recommendations: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Agent Training, Cohort Strategy, Lead Management, Process Improvement, Incentive Adjustment)."),
    recommendation: z.string().describe("A specific, actionable recommendation based on the analysis (e.g., 'Train low-performing agents on X', 'Focus more on Payment Drop-offs cohort due to high ROI potential')."),
    justification: z.string().optional().describe("Briefly mention the analysis findings or data patterns (from user's description) that support this recommendation.")
  })).min(1).describe("At least 1-2 actionable recommendations or next steps derived from the analysis."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided: 2-3 specific insights, simple calculations (e.g. 'Average X from sample is Y'), or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes based on a 'Duration' column.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context. The accuracy and depth of this analysis are directly proportional to the detail provided in the user's input prompt."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;

const dataAnalysisReportPrompt = ai.definePrompt({
  name: 'dataAnalysisReportPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisReportSchema},
  prompt: `You are an advanced Excel analyst AI, specializing in telesales and subscription operations. Your job is not just to describe uploaded Excel files — your job is to intelligently clean, reformat, and analyze business data (as described by the user) for actionable insights.

User's File Context (Names & Types ONLY - you will NOT see the content of binary files like Excel/PDF):
{{#each fileDetails}}
- File Name: {{fileName}} (Type: {{fileType}})
{{/each}}

CRITICAL: User's Detailed Data Description & Analysis Prompt:
This is your PRIMARY and ESSENTIAL source of information about the data structure, contents (including any messiness like misaligned headers, merged rows, nulls like "NA" or "—", specific date formats), specific file mappings (e.g., 'File sales_oct.xlsx is the Monthly Revenue Tracker for Oct.'), decoding rules for coded fields (e.g., 'NR' = Not Reachable, 'CALLB' = Call Back), and the user's analytical goals for this run. Your entire analysis of complex files like Excel hinges on the detail provided here.
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
Based *solely* on the user's "Detailed Data Description & Analysis Prompt" and the "File Context" (and "Sampled Text Content" if available), generate a comprehensive analysis report. You will *act as if* you have performed the following steps on the data as described by the user. Explicitly reference how the user's detailed prompt guided your simulation for steps 1 and 2.

1.  **Data Reconstruction (Simulated Pre-analysis Cleanup)**:
    *   Based on the user's description of their data (e.g., any mentioned malformed tables, misaligned headers, merged rows, repeated titles, varied column formats, hidden headers, merged agent names/cohorts, nulls like "NA", "—"), explain briefly in the \`dataReconstructionAndNormalizationSummary\` section how you would hypothetically identify and correct these issues. For example, if the user states "headers are in row 3 for SheetX", mention how you'd skip initial rows based on this. If they describe specific null values, explain how you'd handle them based on their input.

2.  **Table Normalization (Simulated)**:
    *   Describe in the \`dataReconstructionAndNormalizationSummary\` how you would reconstruct each described sheet or data source into clean, properly labeled tables. For example, based on the user stating "Sheet 'Agent Data' has columns 'Agent', 'Sales', 'Calls'", explain you'd form a conceptual clean dataframe for agent-level data.

3.  **Smart Table Recognition (Based on User's Description)**:
    *   In the \`smartTableRecognitionSummary\` section, explain how you are inferring the purpose of different data tables/sheets described by the user. For instance, if the user describes columns like "Call Status", "Duration", "Follow-up", state you're treating it as CDR data. If they mention "Revenue", "Agent", "Login Hours", you'd treat it as Daily MIS, and so on for "Cohort", "Lead ID", "Source" (Source Dump) or month names + revenue (Monthly Tracker). Explicitly mention if the user's mapping of a file (e.g., 'File sales_oct.xlsx is the Monthly Revenue Tracker for Oct') helped your recognition.

4.  **KPI Calculation (Based on User's Description and Assumed Clean Data)**:
    *   From the *assumed* clean tables (derived from the user's description and your hypothetical cleaning), calculate or explain how you would calculate key KPIs. Populate the \`keyMetrics\` section with these. Use these definitions if applicable and if the user's data description supports them:
        *   Conversion Rate = (Interested + Subscribed outcomes) / Total leads or Total calls (Clarify which based on user's description of available fields like 'Lead ID' vs 'Call ID')
        *   Avg Revenue per Call = Total Revenue / Connected Calls (Specify how 'Connected Calls' is determined, e.g., based on user-defined outcome codes for connection)
        *   Lead Follow-up Rate = (# of CALLB or follow-up attempts) / Total Leads (Relies on user defining follow-up codes)
        *   Connection Rate = (# Connected outcomes like 'INT', 'CALLB', 'ALREAD') / Total Calls (Relies on user defining connected outcome codes)
    *   If revenue is missing from the description, state you are inferring performance using proxy indicators like intent outcome distribution (based on user-defined outcome codes).
    *   Mention how you might rank agents, cohorts, or sources by performance in the \`detailedAnalysis.comparativePerformance\` section.

5.  **Insight Generation (From Assumed Clean Data)**:
    *   Populate the \`detailedAnalysis\` sections (\`timeSeriesTrends\`, \`comparativePerformance\`, \`useCaseSpecificInsights\`) with insights derived from your simulated analysis of the (hypothetically) cleaned data.
    *   Output clean summaries per conceptual table within these sections if appropriate.
    *   Highlight top trends, bottlenecks, and agent or cohort gaps. Refer to user-defined goals (e.g., "Focus on Q1 trends") if provided.
    *   Suggest fixes (e.g., agent coaching, lead rerouting, incentive misalignment) in the \`recommendations\` section.
    *   Be proactive: if something seems off (e.g., very low call duration *as described by the user in their prompt regarding a 'Duration' column*), flag it as a red flag and suggest possible causes.

6.  **Output Style & Structure (Strictly adhere to 'DataAnalysisReportSchema')**:
    *   Be sharp, tabular (use markdown for tables within content strings if helpful), and insight-driven.
    *   Use bullet points or markdown tables for clarity.
    *   Always base insights on the (hypothetically) reconstructed, clean version of the data as understood from the user's prompt.
    *   Do not just say “value cannot be determined” unless data is truly missing or unreadable from the user's description.
    *   **reportTitle**: A comprehensive title.
    *   **executiveSummary**: Critical findings. Explain what the data *means*.
    *   **directInsightsFromSampleText (if applicable)**: 2-3 specific insights *directly* from 'sampledFileContent'.
    *   **keyMetrics**: Quantified KPIs.
    *   **detailedAnalysis**: Include \`dataReconstructionAndNormalizationSummary\`, \`smartTableRecognitionSummary\`, then the analytical findings.
    *   **chartsOrTablesSuggestions (Optional)**: 1-2 suggestions.
    *   **recommendations**: Actionable next steps.
    *   **limitationsAndDisclaimer**: CRITICALLY IMPORTANT - Always include the standard disclaimer: "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context. The accuracy and depth of this analysis are directly proportional to the detail provided in the user's input prompt."

Guiding Principles:
*   **Interpret, Don't Just Describe**: Explain what the data *means* for the business.
*   **Specificity**: Provide actual numbers and specific examples where possible, *based on the user's textual description and sample data*.
*   **Relevance**: Focus on telesales and subscription operations if user context implies it.
*   **Actionable**: Recommendations should be practical.
*   **Based on User's Text**: Your entire analysis is constrained by the textual information provided by the user. Do not invent data or structures not described. Your ability to perform well on "messy" data depends entirely on how well the user describes that messiness and the desired clean state.
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
    const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context. The accuracy and depth of this analysis are directly proportional to the detail provided in the user's input prompt.";
    try {
      if (!input.userAnalysisPrompt || input.userAnalysisPrompt.length < 50) {
        return {
            reportTitle: "Data Analysis Not Performed",
            executiveSummary: "The user's analysis prompt was too short or missing. Please provide a detailed description of your data and analysis goals (min 50 characters).",
            keyMetrics: [],
            detailedAnalysis: {
                dataReconstructionAndNormalizationSummary: "Input prompt insufficient. Describe your data's structure, sheets, columns, and any known issues.",
                smartTableRecognitionSummary: "Input prompt insufficient. Describe the purpose of your files/sheets."
            },
            recommendations: [{ area: "Input", recommendation: "Provide a more detailed analysis prompt.", justification: "Prompt was insufficient." }],
            limitationsAndDisclaimer: `Analysis not performed due to insufficient input. ${defaultDisclaimer}`,
        };
      }

      const {output} = await dataAnalysisReportPrompt(input);
      if (!output) {
        throw new Error("AI failed to generate data analysis report.");
      }
      // Ensure the disclaimer is always present and emphasizes prompt quality.
      if (!output.limitationsAndDisclaimer || !output.limitationsAndDisclaimer.includes("proportional to the detail")) {
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
            dataReconstructionAndNormalizationSummary: "Analysis unavailable due to error.",
            smartTableRecognitionSummary: "Analysis unavailable due to error.",
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
  const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context. The accuracy and depth of this analysis are directly proportional to the detail provided in the user's input prompt.";
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
            dataReconstructionAndNormalizationSummary: "Analysis unavailable due to critical system error.",
            smartTableRecognitionSummary: "Analysis unavailable due to critical system error.",
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


    

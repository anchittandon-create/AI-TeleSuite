
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
 * - analyzeData - a function that generates an analysis report.
 * - DataAnalysisInput - The input type for the function.
 * - DataAnalysisReportOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import { DataAnalysisInputSchema, DataAnalysisReportSchema } from '@/types';
import type { DataAnalysisInput, DataAnalysisReportOutput } from '@/types';

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

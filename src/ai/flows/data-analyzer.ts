
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
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May...', 'CDR Dump as ZIP of CSVs...'), their likely data structure, specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions."),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const DataAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("A comprehensive title for this specific data analysis report, e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)'."),
  executiveSummary: z.string().describe("A concise overview of the key findings and most critical actionables from the entire analysis. At least 2-3 bullet points or a short paragraph."),
  keyMonthlyTrends: z.string().describe("Textual analysis of monthly revenue trends (Oct-May), highlighting spikes, dips, and proposed reasons based on the provided data context (e.g., 'ET MIS Sheet', 'Monthly Revenue Tracker'). Mention specific data points or periods. Describe what a line chart for these trends would show."),
  agentTeamPerformance: z.string().describe("Evaluation of agent-level performance, comparing revenue, conversion %, talktime, and lead handling (from 'ET MIS Sheet', 'CDR Dump', 'Monthly Revenue Tracker'). Identify top/low performers with supporting details and describe what comparative visualizations (e.g., bar charts) would illustrate."),
  cohortAnalysis: z.string().describe("Analysis of performance segmented by cohort (e.g., Payment Drop-off vs Plan Page Drop-off, using 'Source Data Dump', 'Monthly Revenue Tracker'). Identify which segments are converting well, which are underutilized, and any notable differences in metrics. Describe relevant comparative visualizations."),
  callHandlingEfficiency: z.string().describe("Analysis of call-level data from 'CDR Dump' (connection %, avg. talktime, follow-up lag). Correlate these metrics with revenue and conversions. Discuss impact on overall efficiency and describe what visualizations like heatmaps might show for connectivity or follow-up gaps."),
  leadQualityAndFollowUp: z.string().describe("Assessment of lead quality and follow-up discipline based on 'Source Data Dump' and 'CDR Dump'. Are high-intent leads getting ignored? Are follow-ups timely? Are agents prioritizing correctly?"),
  incentiveEffectiveness: z.string().describe("Evaluation of whether the current incentive structure (if described by user in their prompt or inferred from data patterns like AOV related to targets) appears to be driving desired performance, considering AOV, revenue growth, and closures vs. bonus slabs."),
  recommendationsWithDataBacking: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Lead Distribution, Incentive Slabs, Training Needs, Cohort Focus, Process Improvement)."),
    recommendation: z.string().describe("A specific, actionable recommendation."),
    dataBacking: z.string().optional().describe("Briefly mention the data points, analysis findings, or patterns from the described files (e.g., 'from CDR data', 'based on cohort conversion rates in Source Dump') that support this recommendation.")
  })).min(1).describe("At least 1 actionable recommendation, each with a brief mention of its data backing, covering areas like lead distribution, incentives, training, or cohort focus."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided in the input: 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;

const dataAnalysisReportPrompt = ai.definePrompt({
  name: 'dataAnalysisReportPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisReportSchema},
  prompt: `You are an expert data analyst specializing in telecalling operations and sales performance.
Your task is to generate a comprehensive analysis report based on the user's description of their data files and their specific analytical goals for this run.

User's File Context:
{{#each fileDetails}}
- File Name: {{fileName}} (Type: {{fileType}})
{{/each}}

User's Specific Analysis Prompt for this run (supplements the main instructions below):
{{{userAnalysisPrompt}}}

{{#if sampledFileContent}}
Small Sampled Text Content (from first provided CSV/TXT file ONLY, use for direct initial observations):
"""
{{{sampledFileContent}}}
"""
{{/if}}

Main Analysis Instructions (Address all these sections in your report):
1.  **Report Title**: Create a comprehensive title for this specific data analysis report, reflecting the user's prompt and file context (e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)').
2.  **Executive Summary**: Provide a concise overview (2-3 bullet points or a short paragraph) of the most critical findings and actionable insights from your entire analysis.
3.  **Direct Insights from Sampled Text (if applicable)**: If 'sampledFileContent' was provided, derive 2-3 specific, concrete insights, simple calculations, or key observations *directly* from analyzing that sample. State if no sample was provided or if it was unusable. (e.g., "The provided CSV sample shows an average call duration of X minutes.").
4.  **Key Monthly Trends**: Analyze monthly revenue trends (typically Oct-May, adjust if user prompt indicates different period/files like 'ET MIS Sheet', 'Monthly Revenue Tracker'). Highlight spikes, dips, and propose reasons based on the provided data context. Describe what a line chart visualization for these trends would show.
5.  **Agent & Team Performance**: Evaluate agent-level performance. Compare metrics like revenue, conversion %, talk time, lead handling, etc., using context from files like 'ET MIS Sheet', 'CDR Dump', 'Monthly Revenue Tracker'. Identify top/low performers with supporting details from the described data. Describe what comparative visualizations (e.g., bar charts for revenue per agent) would illustrate.
6.  **Cohort Analysis**: Analyze performance segmented by cohort (e.g., 'Payment Drop-off' vs 'Plan Page Drop-off', using context from 'Source Data Dump', 'Monthly Revenue Tracker'). Identify which segments are converting well, which are underutilized, and any notable differences in metrics. Describe relevant comparative visualizations.
7.  **Call Handling Efficiency**: Analyze call-level data from 'CDR Dump' (e.g., connection %, average talk time, follow-up lag). Correlate these with revenue and conversions. Discuss the impact on overall efficiency. Describe what visualizations like heatmaps (for connectivity by time of day) or scatter plots (talk time vs. conversion) might show.
8.  **Lead Quality & Follow-Up Discipline**: Assess lead quality and follow-up discipline based on context from 'Source Data Dump' and 'CDR Dump'. Are high-intent leads being ignored? Are follow-ups timely? Are agents prioritizing correctly?
9.  **Incentive Effectiveness**: Evaluate if the current incentive structure (if described by the user in their prompt or inferable from data patterns like AOV related to targets) appears to be driving desired performance. Consider AOV, revenue growth, and closures vs. bonus slabs from the described data.
10. **Recommendations with Data Backing**: Provide at least 1 (ideally 2-3) specific, actionable recommendations covering areas like lead distribution, incentive structures, training needs, cohort focus, or process improvements. For each recommendation, briefly mention the data points, analysis findings, or patterns from the described files (e.g., 'from CDR data', 'based on cohort conversion rates in Source Dump') that support it.
11. **Limitations and Disclaimer**: Crucially, include the following disclaimer: "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."

**Important Notes for the AI:**
*   **No Direct File Access:** You do NOT have direct access to the internal content of the user's files (especially Excel, PDF, DOCX, ZIP). Your analysis is based *solely* on the user's textual descriptions of these files, their structure, their mappings (e.g., "sales_oct.xlsx is monthly revenue"), the user's specific prompt for this run, and the small text sample if provided.
*   **Infer and Assume Reasonably:** Based on common telecalling data patterns and the user's descriptions, make reasonable inferences about data structures if not explicitly stated.
*   **Structured Output:** Ensure your entire response is a single JSON object matching the 'DataAnalysisReportSchema'.
`,
  model: 'googleai/gemini-2.0-flash'
});

const dataAnalysisReportFlow = ai.defineFlow(
  {
    name: 'dataAnalysisReportFlow',
    inputSchema: DataAnalysisInputSchema,
    outputSchema: DataAnalysisReportSchema,
  },
  async (input: DataAnalysisInput): Promise<DataAnalysisReportOutput> => {
    try {
      const {output} = await dataAnalysisReportPrompt(input);
      if (!output) {
        throw new Error("AI failed to generate data analysis report.");
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in dataAnalysisReportFlow:", error);
      const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context.";
      return {
        reportTitle: "Data Analysis Failed",
        executiveSummary: `Error: ${error.message}. Ensure Google API Key is valid. The AI could not process your request.`,
        keyMonthlyTrends: "Analysis unavailable due to error.",
        agentTeamPerformance: "Analysis unavailable due to error.",
        cohortAnalysis: "Analysis unavailable due to error.",
        callHandlingEfficiency: "Analysis unavailable due to error.",
        leadQualityAndFollowUp: "Analysis unavailable due to error.",
        incentiveEffectiveness: "Analysis unavailable due to error.",
        recommendationsWithDataBacking: [{ area: "Error", recommendation: `Analysis failed: ${error.message}`, dataBacking: "N/A" }],
        directInsightsFromSampleText: input.sampledFileContent ? "Sample not processed due to error." : undefined,
        limitationsAndDisclaimer: `Error occurred during analysis. ${defaultDisclaimer}`,
      };
    }
  }
);

export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisReportOutput> {
  try {
    return await dataAnalysisReportFlow(input);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling dataAnalysisReportFlow:", error);
    const defaultDisclaimer = "This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context.";
    return {
        reportTitle: "Critical System Error in Data Analysis",
        executiveSummary: `A server-side error occurred: ${error.message}. Please check server logs.`,
        keyMonthlyTrends: "Analysis unavailable due to critical system error.",
        agentTeamPerformance: "Analysis unavailable due to critical system error.",
        cohortAnalysis: "Analysis unavailable due to critical system error.",
        callHandlingEfficiency: "Analysis unavailable due to critical system error.",
        leadQualityAndFollowUp: "Analysis unavailable due to critical system error.",
        incentiveEffectiveness: "Analysis unavailable due to critical system error.",
        recommendationsWithDataBacking: [{ area: "System Error", recommendation: `Critical failure: ${error.message}`, dataBacking: "N/A" }],
        directInsightsFromSampleText: input.sampledFileContent ? "Sample not processed due to critical error." : undefined,
        limitationsAndDisclaimer: `Critical error occurred. ${defaultDisclaimer}`,
    };
  }
}

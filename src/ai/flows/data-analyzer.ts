
'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis.
 * Genkit has been removed. This flow will return placeholder error messages.
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

// import {ai} from '@/ai/genkit'; // Genkit removed
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
  executiveSummary: z.string().min(1).describe("A concise overview of the key findings and most critical actionables from the entire analysis. At least 2-3 bullet points or a short paragraph."), // Min 1 for error
  keyMonthlyTrends: z.string().min(1).describe("Textual analysis of monthly revenue trends (Oct-May), highlighting spikes, dips, and proposed reasons based on the provided data context (e.g., 'ET MIS Sheet', 'Monthly Revenue Tracker'). Mention specific data points or periods. Describe what a line chart for these trends would show."),
  agentTeamPerformance: z.string().min(1).describe("Evaluation of agent-level performance, comparing revenue, conversion %, talktime, and lead handling (from 'ET MIS Sheet', 'CDR Dump', 'Monthly Revenue Tracker'). Identify top/low performers with supporting details and describe what comparative visualizations (e.g., bar charts) would illustrate."),
  cohortAnalysis: z.string().min(1).describe("Analysis of performance segmented by cohort (e.g., Payment Drop-off vs Plan Page Drop-off, using 'Source Data Dump', 'Monthly Revenue Tracker'). Identify which segments are converting well, which are underutilized, and any notable differences in metrics. Describe relevant comparative visualizations."),
  callHandlingEfficiency: z.string().min(1).describe("Analysis of call-level data from 'CDR Dump' (connection %, avg. talktime, follow-up lag). Correlate these metrics with revenue and conversions. Discuss impact on overall efficiency and describe what visualizations like heatmaps might show for connectivity or follow-up gaps."),
  leadQualityAndFollowUp: z.string().min(1).describe("Assessment of lead quality and follow-up discipline based on 'Source Data Dump' and 'CDR Dump'. Are high-intent leads getting ignored? Are follow-ups timely? Are agents prioritizing correctly?"),
  incentiveEffectiveness: z.string().min(1).describe("Evaluation of whether the current incentive structure (if described by user in their prompt or inferred from data patterns like AOV related to targets) appears to be driving desired performance, considering AOV, revenue growth, and closures vs. bonus slabs."),
  recommendationsWithDataBacking: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Lead Distribution, Incentive Slabs, Training Needs, Cohort Focus, Process Improvement)."),
    recommendation: z.string().describe("A specific, actionable recommendation."),
    dataBacking: z.string().optional().describe("Briefly mention the data points, analysis findings, or patterns from the described files (e.g., 'from CDR data', 'based on cohort conversion rates in Source Dump') that support this recommendation.")
  })).min(1).describe("At least 1 actionable recommendation, each with a brief mention of its data backing, covering areas like lead distribution, incentives, training, or cohort focus."), // Min 1 for error
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided in the input: 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;

export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisReportOutput> {
  console.warn("Data Analysis: Genkit has been removed. Returning placeholder error response.");
  const errorMessage = "Data Analysis feature is disabled as AI Service (Genkit) has been removed. The AI cannot process your files or prompt.";
  const errorDisclaimer = "This is a placeholder response. AI analysis is disabled. AI has NOT processed any files. Verify all instructions and data independently.";
  try {
      DataAnalysisInputSchema.parse(input); // Basic validation
      return Promise.resolve({
        reportTitle: "Data Analysis Disabled",
        executiveSummary: errorMessage,
        keyMonthlyTrends: "Not available.",
        agentTeamPerformance: "Not available.",
        cohortAnalysis: "Not available.",
        callHandlingEfficiency: "Not available.",
        leadQualityAndFollowUp: "Not available.",
        incentiveEffectiveness: "Not available.",
        recommendationsWithDataBacking: [{ area: "AI Service", recommendation: "Feature Disabled", dataBacking: "Genkit removed" }],
        directInsightsFromSampleText: input.sampledFileContent ? "AI disabled, sample not processed." : undefined,
        limitationsAndDisclaimer: errorDisclaimer,
      });
  } catch (e) {
      const error = e as Error;
      console.error("Error in disabled analyzeData function (likely input validation):", error);
      const validationErrorMessage = `Input Error: ${error.message}. ${errorMessage}`;
      return Promise.resolve({
        reportTitle: "Input Error or AI Feature Disabled",
        executiveSummary: validationErrorMessage,
        keyMonthlyTrends: "Error.",
        agentTeamPerformance: "Error.",
        cohortAnalysis: "Error.",
        callHandlingEfficiency: "Error.",
        leadQualityAndFollowUp: "Error.",
        incentiveEffectiveness: "Error.",
        recommendationsWithDataBacking: [{ area: "Error", recommendation: validationErrorMessage, dataBacking: "Input validation failed" }],
        directInsightsFromSampleText: input.sampledFileContent ? "AI disabled, sample not processed due to input error." : undefined,
        limitationsAndDisclaimer: errorDisclaimer,
      });
  }
}

// const dataAnalysisReportPrompt = ai.definePrompt({ // Genkit removed
//   name: 'dataAnalysisReportPrompt',
//   // ...
// });

// const dataAnalysisReportFlow = ai.defineFlow( // Genkit removed
//   {
//     name: 'dataAnalysisReportFlow',
//     inputSchema: DataAnalysisInputSchema,
//     outputSchema: DataAnalysisReportSchema,
//   },
//   async (input: DataAnalysisInput): Promise<DataAnalysisReportOutput> => {
//     // ... original logic ...
//     throw new Error("dataAnalysisReportFlow called but Genkit is removed.");
//   }
// );

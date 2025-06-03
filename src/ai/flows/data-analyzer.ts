
'use strict';
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

// Schema for the input to the AI flow (remains largely the same)
const DataAnalysisInputSchema = z.object({
  fileDetails: z.array(z.object({
    fileName: z.string().describe("The name of one of the user's files."),
    fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').")
  })).min(1).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().min(50).describe("The user's detailed prompt (min 50 characters) describing their files (e.g., 'Monthly MIS in Excel with sheets for Oct-May...', 'CDR Dump as ZIP of CSVs...'), their likely data structure, specific file mappings ('My file 'sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'), and specific analytical goals or areas of focus for THIS run (e.g., 'Focus the trend analysis specifically on Q4 & Q1, identify top agents...'). This supplements the main analysis instructions."),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

// NEW Schema for the structured Analysis Report output from the AI
const DataAnalysisReportSchema = z.object({
  reportTitle: z.string().describe("A comprehensive title for this specific data analysis report, e.g., 'Telecalling Performance & Revenue Attribution Analysis (Oct-May)'."),
  executiveSummary: z.string().min(50).describe("A concise overview of the key findings and most critical actionables from the entire analysis. At least 2-3 bullet points or a short paragraph."),
  keyMonthlyTrends: z.string().min(50).describe("Textual analysis of monthly revenue trends (Oct-May), highlighting spikes, dips, and proposed reasons based on the provided data context (e.g., 'ET MIS Sheet', 'Monthly Revenue Tracker'). Mention specific data points or periods. Describe what a line chart for these trends would show."),
  agentTeamPerformance: z.string().min(50).describe("Evaluation of agent-level performance, comparing revenue, conversion %, talktime, and lead handling (from 'ET MIS Sheet', 'CDR Dump', 'Monthly Revenue Tracker'). Identify top/low performers with supporting details and describe what comparative visualizations (e.g., bar charts) would illustrate."),
  cohortAnalysis: z.string().min(50).describe("Analysis of performance segmented by cohort (e.g., Payment Drop-off vs Plan Page Drop-off, using 'Source Data Dump', 'Monthly Revenue Tracker'). Identify which segments are converting well, which are underutilized, and any notable differences in metrics. Describe relevant comparative visualizations."),
  callHandlingEfficiency: z.string().min(50).describe("Analysis of call-level data from 'CDR Dump' (connection %, avg. talktime, follow-up lag). Correlate these metrics with revenue and conversions. Discuss impact on overall efficiency and describe what visualizations like heatmaps might show for connectivity or follow-up gaps."),
  leadQualityAndFollowUp: z.string().min(50).describe("Assessment of lead quality and follow-up discipline based on 'Source Data Dump' and 'CDR Dump'. Are high-intent leads getting ignored? Are follow-ups timely? Are agents prioritizing correctly?"),
  incentiveEffectiveness: z.string().min(50).describe("Evaluation of whether the current incentive structure (if described by user in their prompt or inferred from data patterns like AOV related to targets) appears to be driving desired performance, considering AOV, revenue growth, and closures vs. bonus slabs."),
  recommendationsWithDataBacking: z.array(z.object({
    area: z.string().describe("The area the recommendation pertains to (e.g., Lead Distribution, Incentive Slabs, Training Needs, Cohort Focus, Process Improvement)."),
    recommendation: z.string().describe("A specific, actionable recommendation."),
    dataBacking: z.string().optional().describe("Briefly mention the data points, analysis findings, or patterns from the described files (e.g., 'from CDR data', 'based on cohort conversion rates in Source Dump') that support this recommendation.")
  })).min(3).describe("At least 3 actionable recommendations, each with a brief mention of its data backing, covering areas like lead distribution, incentives, training, or cohort focus."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided in the input: 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. E.g., 'The provided CSV sample shows an average call duration of X minutes.' If no sample, or sample is unusable, this field should state that or be omitted."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer: This AI-generated analysis is based on the user's description of their data and any provided text samples. The AI has NOT directly processed or validated the content of complex binary files (Excel, DOCX, PDF, ZIP). The user is responsible for verifying all findings against their actual full datasets and business context."),
});
export type DataAnalysisReportOutput = z.infer<typeof DataAnalysisReportSchema>;


export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisReportOutput> {
  try {
    return await dataAnalysisReportFlow(input);
  } catch (e) {
    console.error("Catastrophic error in analyzeData flow INVOCATION:", e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected catastrophic error occurred invoking the data analysis flow.";
    return {
      reportTitle: "Critical Flow Invocation Error",
      executiveSummary: `Analysis failed: ${errorMessage}`,
      keyMonthlyTrends: "Unavailable due to critical error.",
      agentTeamPerformance: "Unavailable due to critical error.",
      cohortAnalysis: "Unavailable due to critical error.",
      callHandlingEfficiency: "Unavailable due to critical error.",
      leadQualityAndFollowUp: "Unavailable due to critical error.",
      incentiveEffectiveness: "Unavailable due to critical error.",
      recommendationsWithDataBacking: [{ area: "Critical Error", recommendation: `Flow failed to execute. Details: ${errorMessage.substring(0,100)}...`, dataBacking: "N/A" }],
      limitationsAndDisclaimer: `A critical system error prevented the analysis flow from running. Details: ${errorMessage}. Please check server logs. Ensure API key is set in .env.`,
      directInsightsFromSampleText: input.sampledFileContent ? `Processing of sample content failed due to critical error: ${errorMessage}` : undefined,
    };
  }
}

const dataAnalysisReportPrompt = ai.definePrompt({
  name: 'dataAnalysisReportPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisReportSchema},
  prompt: `You are a skilled data analyst trained in sales operations and revenue attribution for telesales businesses. I am providing you with descriptions of multiple Excel sheets and data dumps that capture the full funnel — from leads to calls to revenue — across ET Prime and TOI Plus. Your task is to perform a comprehensive analysis based on these descriptions and generate a structured report.

**Summary of Data Sources (as described by the user, names/types provided in 'fileDetails' input):**

1.  **ET MIS Sheet**:
    – Daily tracker of agent-wise revenue, login hours, talktime, and conversion %.
    – Use this to benchmark daily productivity and performance fluctuations across agents.

2.  **CDR Dump**:
    – Contains call metadata: status (connected, not connected, follow-up), duration, agent, timestamps.
    – Critical for analyzing connectivity efficiency, talktime impact, and follow-up effectiveness.

3.  **Source Data Dump**:
    – Raw lead-level file: includes cohort type (e.g. Payment Drop-off, Plan Page Drop-off), lead ID, contact info, and agent mapping.
    – Useful for attribution to specific campaigns, drop-off segments, and source quality assessment.

4.  **Monthly Revenue Tracker (Oct, Nov, Dec, Jan, Mar, Apr, May)**:
    – Summarized agent and team performance month-on-month, including revenue by cohort and plan type sold.
    – Helps spot growth or decline phases and tie them to campaigns or agent changes.

5.  **APR Report**:
    – Deep-dive report for April (a key intervention month).
    – Use this to benchmark the impact of training or new campaigns on agent/campaign performance.

**User's File Details (Names and Types provided for THIS analysis run):**
{{#each fileDetails}}
- File Name: "{{this.fileName}}", File Type: "{{this.fileType}}"
{{/each}}

{{#if sampledFileContent}}
**A small sample from one of the text-based files (e.g., CSV/TXT) has been provided for direct initial analysis:**
Sampled File Content (first ~10k chars):
\`\`\`
{{{sampledFileContent}}}
\`\`\`
You MUST analyze this specific sample content and provide direct observations in the 'directInsightsFromSampleText' field of your JSON output. If too brief/generic, state that.
{{else}}
(No direct text sample provided for this run. Base analysis on file descriptions and user prompt.)
{{/if}}

{{#if userAnalysisPrompt}}
**Additional User Instructions/Context for THIS Specific Analysis (Pay close attention to these):**
{{{userAnalysisPrompt}}}
(This may include specific file mappings, e.g., "'my_sales_oct.xlsx' is the 'Monthly Revenue Tracker for Oct'", or specific questions to prioritize.)
{{/if}}

**Your Analysis Tasks (Perform these based on the described data sources and any user instructions):**

1.  **Data Understanding**: Briefly acknowledge the described data sources and how they interrelate for the analysis.
2.  **Key Monthly Trends**: Track monthly revenue trends from Oct to May. Highlight key spikes/dips and propose reasons (e.g., lead drop, agent downtime, campaign change based on the descriptions of 'ET MIS', 'Monthly Revenue Tracker'). Describe what a line chart would show.
3.  **Agent-Level Performance**: Evaluate agent-level performance: compare revenue, conversion %, talktime, and lead handling (from 'ET MIS Sheet', 'CDR Dump', 'Monthly Revenue Tracker'). Identify top/low performers. Describe what bar charts or tables would show.
4.  **Call-Level Data Analysis**: Analyze call-level data (from 'CDR Dump'): calculate/infer connection %, avg. talktime, and follow-up lag. Correlate with revenue and conversions. Describe what heatmaps or charts of connectivity/follow-up gaps would show.
5.  **Cohort Performance**: Segment performance by cohort (e.g., Payment Drop-off vs Plan Page Drop-off, using 'Source Data Dump', 'Monthly Revenue Tracker'). Identify which segments are converting and which might be underutilized.
6.  **Lead Quality & Follow-up**: Assess lead quality and follow-up discipline from 'Source Data Dump' and 'CDR Dump'. Are high-intent leads getting ignored? Are follow-ups timely? Are agents prioritizing the right leads?
7.  **Incentive Structure Effectiveness**: Evaluate if the current incentive structure (if described by user) is driving desired performance. Compare AOV, revenue growth, and closures vs. bonus slabs.
8.  **Actionable Recommendations**: Provide specific, actionable recommendations for:
    – Changes in lead distribution.
    – Adjustments to incentive slabs.
    – Training needs for specific agents or segments.
    – Cohorts that need more focused attention.
    Ensure each recommendation is backed by data insights derived from your analysis of the described files.

**Final Output Format (Ensure your entire response is a single JSON object matching this structure):**
-   \`reportTitle\`: A comprehensive title for this analysis report.
-   \`executiveSummary\`: Concise overview of key findings and critical actionables.
-   \`keyMonthlyTrends\`: Textual analysis of monthly trends and visualization description.
-   \`agentTeamPerformance\`: Evaluation of agent performance and visualization description.
-   \`cohortAnalysis\`: Analysis of cohort performance and visualization description.
-   \`callHandlingEfficiency\`: Analysis of call data, efficiency, and visualization description.
-   \`leadQualityAndFollowUp\`: Assessment of lead quality and follow-up discipline.
-   \`incentiveEffectiveness\`: Evaluation of incentive structure.
-   \`recommendationsWithDataBacking\`: Array of objects, each with 'area', 'recommendation', and 'dataBacking'.
-   \`directInsightsFromSampleText\`: (CONDITIONAL - ONLY if 'sampledFileContent' was provided and usable) Specific insights from the sample text. If no sample or unusable, state that or omit.
-   \`limitationsAndDisclaimer\`: Standard disclaimer about AI analysis based on descriptions, not direct file processing of binaries.

Be sharp, quantified where possible (based on descriptions), and business-focused. Avoid fluff. Drive insights that will directly impact agent efficiency, lead conversion, and revenue scale-up.
The analysis should be comprehensive and directly address the tasks using the context of the described files.
Output the entire response in the specified JSON format.
`,
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
        console.error("Data analysis report flow: Prompt returned null or undefined output for input:", input.userAnalysisPrompt);
        return {
          reportTitle: "Error: AI Prompt Returned No Output",
          executiveSummary: "The AI prompt completed but returned no structured output. This might indicate an issue with the prompt's ability to generate content for the given input, or a very unusual LLM response. Ensure API key is set in .env.",
          keyMonthlyTrends: "Analysis unavailable.",
          agentTeamPerformance: "Analysis unavailable.",
          cohortAnalysis: "Analysis unavailable.",
          callHandlingEfficiency: "Analysis unavailable.",
          leadQualityAndFollowUp: "Analysis unavailable.",
          incentiveEffectiveness: "Analysis unavailable.",
          recommendationsWithDataBacking: [{ area: "Error", recommendation: "AI returned no output.", dataBacking: "N/A" }],
          limitationsAndDisclaimer: "The AI analysis could not be completed as the prompt returned no data. Please review your input and try again. If the problem persists, it might be an internal AI configuration or model issue. Ensure API key is set in .env.",
          directInsightsFromSampleText: input.sampledFileContent ? "AI returned no output, so sample content was not processed for direct insights." : undefined,
        };
      }
      
      const validatedOutput: DataAnalysisReportOutput = {
        reportTitle: output.reportTitle || "Comprehensive Data Analysis Report (Title Missing)",
        executiveSummary: output.executiveSummary || "No executive summary provided by AI.",
        keyMonthlyTrends: output.keyMonthlyTrends || "Monthly trend analysis not provided by AI.",
        agentTeamPerformance: output.agentTeamPerformance || "Agent/team performance analysis not provided by AI.",
        cohortAnalysis: output.cohortAnalysis || "Cohort analysis not provided by AI.",
        callHandlingEfficiency: output.callHandlingEfficiency || "Call handling efficiency analysis not provided by AI.",
        leadQualityAndFollowUp: output.leadQualityAndFollowUp || "Lead quality/follow-up assessment not provided by AI.",
        incentiveEffectiveness: output.incentiveEffectiveness || "Incentive effectiveness evaluation not provided by AI.",
        recommendationsWithDataBacking: output.recommendationsWithDataBacking && output.recommendationsWithDataBacking.length > 0 
                                        ? output.recommendationsWithDataBacking 
                                        : [{ area: "General", recommendation: "No specific recommendations generated by AI.", dataBacking: "N/A" }],
        directInsightsFromSampleText: output.directInsightsFromSampleText, 
        limitationsAndDisclaimer: output.limitationsAndDisclaimer || "Standard AI analysis limitations apply. Verify findings. AI did not provide a specific disclaimer.",
      };
      
      if (input.sampledFileContent && (!validatedOutput.directInsightsFromSampleText || validatedOutput.directInsightsFromSampleText.trim() === "")) {
          validatedOutput.directInsightsFromSampleText = "The AI was instructed to analyze the provided text sample but did not return specific direct insights. It might have found the sample too brief or generic, but it was considered for the overall analysis.";
      }

      return validatedOutput;

    } catch (error) {
      console.error("Data analysis report flow: Error during prompt execution or data processing:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during analysis generation.";
      return {
        reportTitle: "Error Generating Analysis Report",
        executiveSummary: `Failed to generate executive summary. Error: ${errorMessage}`,
        keyMonthlyTrends: `Error: ${errorMessage}`,
        agentTeamPerformance: `Error: ${errorMessage}`,
        cohortAnalysis: `Error: ${errorMessage}`,
        callHandlingEfficiency: `Error: ${errorMessage}`,
        leadQualityAndFollowUp: `Error: ${errorMessage}`,
        incentiveEffectiveness: `Error: ${errorMessage}`,
        recommendationsWithDataBacking: [{ area: "Error", recommendation: `AI failed to generate recommendations. Details: ${errorMessage.substring(0,100)}...`, dataBacking: "N/A" }],
        limitationsAndDisclaimer: `The AI analysis report generation process encountered an error: ${errorMessage}. Please try again. This output is not a valid analysis report. Check if an API key is set in your .env file.`,
        directInsightsFromSampleText: input.sampledFileContent ? `AI failed to process the sample content for direct insights due to an error: ${errorMessage}` : undefined,
      };
    }
  }
);
    
    


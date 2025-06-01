
'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis strategist.
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
  })).describe("An array of objects, each describing a file the user intends to analyze. The AI uses these names and types as context alongside the user's detailed prompt."),
  userAnalysisPrompt: z.string().describe("The user's detailed prompt describing their data, files (e.g., CDR Dump, Source Data Dump, Monthly MIS, Revenue sheet), and specific analytical goals. This is the primary input for the AI to generate its strategic playbook."),
  sampledFileContent: z.string().optional().describe("A small text sample (e.g., first 10,000 characters) ONLY if one of the primary files is CSV/TXT. The AI uses this for more concrete initial observations if available, but the main output is still a strategic playbook. This field is undefined for Excel, DOCX, PDF etc."),
});
export type DataAnalysisStrategyInput = z.infer<typeof DataAnalysisStrategyInputSchema>;

// Schema for the structured "Analysis Playbook" output from the AI
const DataAnalysisStrategyOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise and relevant title for the generated Analysis Playbook (e.g., 'Strategic Analysis Plan for Monthly Business Performance Data')."),
  executiveSummary: z.string().describe("Bullet points summarizing the overall recommended analysis strategy and the potential high-level insights the user might aim to uncover by following this playbook."),
  dataUnderstandingAndPreparationGuide: z.string().describe("Guidance on understanding the described data sources (e.g., 'For your CDR Dump, typically look for columns like Call_ID, Caller_Number, Agent_ID, Call_Duration, Call_Outcome. For MIS files, ensure consistent date formats for monthly aggregation.'). Include general tips for data cleaning and preparation relevant to the described scenario, such as handling missing values or standardizing headers."),
  keyMetricsAndKPIsToFocusOn: z.array(z.string()).min(3).describe("A list of at least 3 key metrics and KPIs the user should focus on calculating or tracking, based on their described goals and files (e.g., 'Monthly Recurring Revenue (MRR) Growth Rate', 'Agent-wise Conversion Rate (Sales/Unique Leads)', 'Average Handle Time (AHT)', 'Cohort Retention Rate: Month 1 to Month 3', 'Lead Source ROI')."),
  suggestedAnalyticalSteps: z.array(z.object({
    area: z.string().describe("The analysis area, e.g., 'Trend Analysis Across Months', 'Lead & Agent Performance Deep Dive', 'Cohort/Source-Wise Funnel Drop-offs', 'Attribution & Campaign Effectiveness'."),
    steps: z.string().describe("Detailed textual guidance for this area: key questions to ask, data points/files to correlate, and methods to use. E.g., 'For Trend Analysis: Aggregate key KPIs (Revenue, Sales Volume, New Customers) from your MIS files monthly. Plot these on line charts to visualize MoM and YoY growth. Segment trends by product or major cohorts if data allows. Identify peak and slump periods and hypothesize reasons by correlating with campaign data or external factors.'")
  })).min(3).describe("At least 3 detailed sections outlining analytical approaches for different areas relevant to the user's prompt."),
  visualizationRecommendations: z.array(z.object({
    chartType: z.string().describe("Recommended type of chart or table (e.g., 'Line Chart', 'Bar Chart', 'Stacked Bar Chart', 'Funnel Chart', 'Scatter Plot', 'Pivot Table Summary')."),
    description: z.string().describe("Description of what data this visualization should represent and what insight it might provide (e.g., 'Line chart displaying Monthly Revenue Trend to identify growth patterns', 'Bar chart ranking Agents by Total Revenue Generated', 'Funnel chart showing drop-offs from Lead to Sale by Cohort').")
  })).min(2).describe("At least 2 recommendations for visualizations."),
  potentialDataIntegrityChecks: z.array(z.string()).min(2).describe("A list of at least 2 potential data integrity issues or checks the user should perform (e.g., 'Verify call timestamps in CDR data align with MIS reporting periods.', 'Check for and handle duplicate lead IDs across Source Data and MIS files.', 'Ensure agent IDs are consistent between CDR and MIS datasets.')."),
  strategicRecommendationsForUser: z.array(z.string()).min(2).describe("At least 2-3 high-level strategic recommendations that the user might derive *after* performing the analysis, based on the types of insights their data could yield (e.g., 'Focus on optimizing conversion scripts for underperforming agent groups.', 'Reallocate marketing budget towards high-performing lead sources.', 'Develop targeted retention strategies for cohorts showing high churn.'). These are *potential* outcomes of the user's analysis."),
  topRevenueImprovementAreasToInvestigate: z.array(z.string()).min(2).max(3).describe("Suggest 2-3 top areas where the user's analysis (based on the provided strategy) is most likely to reveal opportunities for revenue improvement (e.g., 'Improving conversion rates of high-potential but underperforming lead sources.', 'Reducing churn in specific customer cohorts.', 'Upselling existing customers based on usage patterns if discernible from MIS.')."),
  limitationsAndDisclaimer: z.string().describe("A clear disclaimer stating that this output is an AI-generated strategic guide for analysis. The AI has not directly processed or validated the content of complex binary files like Excel. The user is responsible for performing the actual data processing, calculations, and validation using appropriate tools."),
  directInsightsFromSampleText: z.string().optional().describe("If a text sample (CSV/TXT) was provided, 2-3 specific insights, simple calculations, or key observations derived *directly* from analyzing that sample content. This is distinct from the broader strategic playbook. E.g., 'The provided CSV sample (first 100 rows) shows an average call duration of 2.5 minutes, with 60% of calls resulting in a 'Sale' outcome.'")
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
  prompt: `You are an Expert Data Analysis Strategist and Senior Business Consultant, like a top-tier analyst from companies known for advanced AI data interpretation (e.g., models like Gemini Pro, tools like Julius AI, or analysts using ChatGPT-4o with code execution).
Your primary task is to provide a comprehensive, actionable strategic playbook to guide a user in analyzing their business performance data. The user will describe their files and analytical goals in 'userAnalysisPrompt'. You also have 'fileDetails' (names and types of their files like Excel, CSV, etc.) for context.

IMPORTANT CONTEXT:
- You CANNOT directly access or process the internal content of complex binary files (Excel, DOCX, PDF, ZIP). Your guidance for these must be based on the user's description, the file names/types, and your expert knowledge of how such data is typically structured and analyzed in telecalling.
- If 'sampledFileContent' (a small text snippet from a CSV/TXT file) is provided, you MUST use that to:
    1.  Provide 2-3 CONCRETE, ACTIONABLE INSIGHTS or direct findings from THIS SAMPLE in the 'directInsightsFromSampleText' field. For example, if the sample shows call durations, calculate an average. If it shows outcomes, identify the most frequent one. These insights should be distinct from the broader strategic playbook and clearly state they are from the provided sample only.
    2.  Use these sample-based insights to make your overall strategic playbook more tailored and concrete, especially in sections like 'dataUnderstandingAndPreparationGuide' and 'keyMetricsAndKPIsToFocusOn'.

User's File Details:
{{#each fileDetails}}
- File Name: "{{this.fileName}}", File Type: "{{this.fileType}}"
{{/each}}

User's Detailed Analysis Prompt (Primary Input):
{{{userAnalysisPrompt}}}

{{#if sampledFileContent}}
A small sample from one of the text-based files (e.g., CSV/TXT) has been provided.
Sampled File Content (first ~10k chars):
\`\`\`
{{{sampledFileContent}}}
\`\`\`
Remember to analyze this sample for 2-3 direct insights for the 'directInsightsFromSampleText' field, and use it to inform the broader playbook.
{{/if}}

Based on ALL the above information, generate a detailed "Analysis Playbook" with the following sections. Be highly specific, actionable, and assume the user has access to tools like Excel, Python (with Pandas, Matplotlib/Seaborn), or a BI tool to implement your strategy.

1.  **analysisTitle**: Create a concise, professional title for this playbook (e.g., "Strategic Telecalling Performance Analysis Playbook").
2.  **executiveSummary**: Provide bullet points summarizing:
    *   The overall strategic approach to analyzing the described data to achieve the user's goals.
    *   The types of high-level insights the user should aim to uncover (e.g., identifying key revenue drivers, pinpointing operational inefficiencies, optimizing agent performance for specific cohorts).
3.  **dataUnderstandingAndPreparationGuide**:
    *   For each *type* of file described by the user (e.g., "CDR Dump", "Monthly MIS", "Revenue Sheet", "Source Data Dump"), suggest typical key columns or data points relevant to telecalling (e.g., 'Call_ID', 'Agent_ID', 'Call_Duration_Seconds', 'Call_Outcome', 'Lead_Source', 'Sale_Value', 'Timestamp').
    *   If it's an Excel file, hypothesize potential sheet names (e.g., 'Agent_Performance_Dashboard', 'Detailed_Call_Logs_Oct23', 'Revenue_Tracker') and common column headers you'd expect for at least two key hypothesized sheets, explaining how these structures would enable the user's analysis goals.
    *   Provide actionable advice on data cleaning and preparation steps (e.g., standardizing headers across related files/sheets, handling missing values with appropriate methods, parsing date/time fields, ensuring numeric fields are correctly typed, checking for duplicates, VLOOKUP/JOIN strategies to link data).
    *   If 'sampledFileContent' was provided, incorporate observations from it here to make the guidance more specific.
4.  **keyMetricsAndKPIsToFocusOn**: List at least 3-5 critical metrics and KPIs the user should calculate and track, directly relevant to their stated goals and the described data. Be specific (e.g., "Month-over-Month (MoM) Revenue Growth %", "Agent Conversion Rate (Number of Sales / Number of Unique Leads Handled)", "Average Handle Time (AHT) per Agent", "Cohort-wise Funnel Conversion Rate: Paywall Interactions to Successful Payments", "Lead Source ROI (Revenue Generated / Cost of Lead Source)", "Call Connectivity Rate").
5.  **suggestedAnalyticalSteps**: This is a CRITICAL section. For each major analytical area implied by the user's prompt (e.g., Trends, Agent Performance, Cohort/Funnel Analysis, Campaign Attribution), provide:
    *   A clear 'area' title (e.g., "Monthly Performance Trend Analysis", "Agent Efficiency & Effectiveness Deep Dive").
    *   Detailed 'steps' in paragraph or bulleted form:
        *   What specific questions should the user try to answer within this area?
        *   Which data from their described files/sheets needs to be combined or correlated? (e.g., "Correlate 'Call_Outcome' from CDR with 'Lead_Source' from Source Data and 'Sale_Value' from Revenue Sheet to analyze source effectiveness.").
        *   What analytical methods or calculations should be applied? (e.g., "Calculate MoM growth for overall revenue and segment by product/cohort.", "Perform a cohort analysis by grouping leads by their acquisition month/source.", "Use Pivot Tables in Excel or GROUP BY in SQL/Python to aggregate agent performance.").
        *   For Excel files, give specific examples of how they might use Excel functions or features (PivotTables, VLOOKUP, AVERAGEIF, SUMIF) to achieve this for the hypothesized data structure.
        *   Hypothesize on potential issues to look out for or specific segments to compare (e.g., "Compare conversion rates of agents handling different lead sources; investigate agents with high call volume but low conversion.").
6.  **visualizationRecommendations**: Suggest at least 2-3 specific chart types or tables and what they should represent.
    *   'chartType': (e.g., "Line Chart", "Bar Chart", "Stacked Bar Chart", "Funnel Chart", "Scatter Plot", "Pivot Table Summary").
    *   'description': (e.g., "Line chart showing monthly revenue and sales volume trends, segmented by cohort.", "Stacked bar chart comparing agent performance on conversion rate and AOV, filterable by month.", "Funnel chart visualizing drop-offs at each stage (Plan Page, Paywall, Payment, Expiry) for key cohorts.").
7.  **potentialDataIntegrityChecks**: List at least 2-3 specific data integrity checks the user should perform on their actual data. (e.g., "Ensure Agent IDs are consistent and correctly mapped across CDR, MIS, and Revenue files.", "Validate that call timestamps in CDRs fall within the correct monthly MIS reporting periods.", "Check for an unusually high number of very short or very long duration calls in the CDRs that might indicate connection issues or data errors.", "Verify lead uniqueness and consistency of lead IDs across Source Data and MIS files.").
8.  **strategicRecommendationsForUser**: Based on the *potential* insights the user might find by following your playbook, suggest 2-3 high-level, actionable strategic recommendations relevant to telecalling. (e.g., "If analysis reveals Source X has high conversion but low volume, recommend strategies to scale lead generation from Source X.", "If top agents show specific patterns in call handling (e.g., shorter AHT with high conversion), consider incorporating these patterns into training modules for other agents.", "If specific cohorts show high drop-off at the payment stage, recommend reviewing the payment process or offering targeted assistance."). These are forward-looking.
9.  **topRevenueImprovementAreasToInvestigate**: Based on common telecalling business scenarios and the user's described data/goals, identify 2-3 top areas where their detailed analysis is most likely to uncover significant opportunities for revenue improvement (e.g., "Optimizing scripts and handling for the 'Paywall Dropoff' cohort.", "Improving conversion rates of agents currently below the team average.", "Targeting high-propensity expired users with tailored renewal offers.").
10. **directInsightsFromSampleText**: (ONLY if 'sampledFileContent' was provided) Provide 2-3 brief, concrete insights or simple calculations directly derived from analyzing the 'sampledFileContent'. Prefix with "From the provided text sample:". For example: "From the provided text sample (first 100 lines of CSV): The average 'Call_Duration' is 185 seconds. The 'Call_Outcome' column shows 'Sale' in 15% of the sampled calls." Clearly state that these insights are based *only* on the limited sample. If no sample, or sample is not useful for direct insights, omit this field or state "No direct actionable insights could be derived from the provided sample."
11. **limitationsAndDisclaimer**: CRITICAL: Clearly state: "This output is an AI-generated strategic playbook to guide your data analysis. The AI has NOT directly processed, validated, or performed calculations on the internal content of complex binary files (Excel, DOCX, PDF, ZIP). For CSV/TXT files, only a small sample was analyzed for the 'directInsightsFromSampleText' section. You are responsible for implementing the actual data processing, calculations, and validation using appropriate tools (like Excel, Python, or BI software) on your full datasets. Always critically evaluate the AI's suggestions against your actual data and business context."

Ensure the entire output is well-structured, professional, and provides genuinely helpful, expert-level guidance for a telecalling business context.
Output the entire response in the specified JSON format.
`,
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
    if (input.sampledFileContent && !output.directInsightsFromSampleText) {
        output.directInsightsFromSampleText = "AI did not provide specific direct insights from the sample, but it was considered for the overall playbook.";
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

    

    

'use server';
/**
 * @fileOverview AI-powered telecalling performance data analysis flow.
 *
 * - analyzeData - A function that handles the data analysis process.
 * - DataAnalysisInput - The input type for the analyzeData function.
 * - DataAnalysisOutput - The return type for the analyzeData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DataAnalysisInputSchema = z.object({
  fileName: z.string().describe("The name of the file being analyzed."),
  fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')."),
  fileContent: z.string().optional().describe("The text content of the file, if it's a text-based format like CSV or TXT (e.g., first 10000 characters or a representative sample). For binary files like DOCX/XLSX, this will be empty or undefined."),
  userDescription: z.string().optional().describe("A user-provided description of the data or the specific analysis goal related to telecalling performance (e.g., 'Analyze agent conversion rates and call durations from this Q1 call log CSV.')."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const DataAnalysisOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise title for the performance analysis (e.g., 'Telecalling Performance Analysis: Q3 Sales Data')."),
  dataOverview: z.string().describe("A brief description of the data analyzed (or hypothesized data for binary files) and its relevance to telecalling performance (e.g., 'Analysis of call logs from March, focusing on call duration and outcomes.'). For Excel, this should include hypothesized sheet/column structures."),
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings. For text-based files, these MUST be directly derived from the provided 'fileContent', reflecting analytical insights (patterns, correlations, anomalies). For binary files, these are SOPHISTICATED HYPOTHETICAL insights based on metadata, user description, and robustly hypothesized data structures (especially for Excel), framed conditionally. Each finding MUST be an INSIGHT or CONCLUSION (e.g., 'Agent Smith exhibited a 15% higher conversion rate for Product Y compared to other agents in this dataset.') NOT just a data point (e.g., 'The data contains Agent Smith and Product Y')."),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed (or potential trends for binary files, linked to hypothesized data and analytical reasoning). Example: 'An upward trend in evening shift conversion rates was observed over the past month based on call outcomes and timestamps.' or 'A potential trend for a file named 'quarterly_sales.xlsx' could be seasonal variations in sales if time-series data and sales figures are present, which could be verified using time-series analysis in Excel.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance is strong (or potentially strong for binary files), based on the data insights or hypothesized data and analytical reasoning."),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved (or potentially improved for binary files), supported by data insights or hypothesized data and analytical reasoning."),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team (or potential recommendations for binary files) based on the analysis, hypothesized data, and reasoned insights."),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis (e.g., analysis based on partial content for large text files, HYPOTHETICAL analysis for binary files due to no direct content access, inability to perform deep statistical analysis due to data structure or lack of clear telecalling operational data, data quality issues if apparent in sample)."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggestions for further analysis or actions (e.g., 'Correlate call duration with sales outcomes using a larger dataset and statistical tools.', 'Analyze sentiment in call notes for agents with low conversion rates.', 'For Excel file, use pivot tables on hypothesized 'Sales' and 'Agent' columns to verify conversion rate differences.')."),
  extractedDataSample: z.string().optional().describe("If a simple table structure was detected in 'fileContent' (like CSV), a small sample of that data (e.g., first few rows as text) that was used for analysis. This is plain text, not a formatted table object. Not applicable for binary files where 'fileContent' is undefined."),
});
export type DataAnalysisOutput = z.infer<typeof DataAnalysisOutputSchema>;

export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisOutput> {
  return dataAnalysisFlow(input);
}

const dataAnalysisPrompt = ai.definePrompt({
  name: 'telecallingPerformanceAnalysisPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisOutputSchema},
  prompt: `You are an expert Telecalling Performance Data Analyst. Your primary function is to **extract deep, actionable business insights** from telecalling-related data, similar to how a top-tier analyst using advanced tools would reason.

File Name: {{{fileName}}}
File Type: {{{fileType}}}
User's Goal/Description for Analysis: {{{userDescription}}}

{{#if fileContent}}
INSTRUCTIONS FOR ANALYZING PROVIDED TEXT CONTENT (CSV/TXT):
The 'fileContent' below is from a text-based file (e.g., CSV, TXT). It might be a sample (e.g., first 10,000 characters) of a larger file.
Your analysis MUST be based **DIRECTLY and DEEPLY on this provided 'fileContent'**.

Data Content (from CSV/TXT file - this is the data you MUST analyze):
\`\`\`
{{{fileContent}}}
\`\`\`
1.  **Role**: Act as a Senior Data Analyst. Your goal is to **INTERPRET** this data, identify patterns, correlations, anomalies, and provide strategic insights, not just describe it.
2.  **Column Inference & Data Typing**: Attempt to infer potential column headers if they are not explicit. Identify likely data types (numeric, categorical, date/time, text).
3.  **Analysis Focus**: Generate an 'analysisTitle'. Provide a 'dataOverview' describing the data from a telecalling performance perspective based on the 'fileContent'.
4.  **Key Observations & Findings (Minimum 2-5 detailed insights from 'fileContent')**:
    *   This is CRITICAL. Each finding in 'keyObservationsAndFindings' MUST be a specific, data-driven **analytical insight or conclusion directly from the 'fileContent'**.
    *   **DO NOT** just list data points or describe columns (e.g., "The data shows Agent, Product, Outcome." is BAD).
    *   **DO** look for patterns, correlations, anomalies, or comparisons within the 'fileContent'. Examples:
        *   "Agent X has a 20% higher 'Sale' outcome for 'Product Y' calls compared to other agents *in this dataset sample*, suggesting superior product knowledge or sales technique for Y." (GOOD INSIGHT)
        *   "Calls lasting over 5 minutes *in this sample* have a 30% lower conversion rate than calls under 3 minutes, possibly indicating inefficiencies or customer disengagement in longer calls." (GOOD INSIGHT)
        *   "A significant portion (e.g., 40%) of 'No Sale' outcomes in this sample are associated with 'Pricing' as a reason, if such data exists."
    *   If '{{{userDescription}}}' provides a goal, focus findings towards it using the 'fileContent'.
    *   If text fields (like notes) in 'fileContent' seem to contain customer feedback, attempt a qualitative sentiment assessment and include it (e.g., "A high number of 'Notes' entries for 'Product Z' in this sample mention 'too expensive', suggesting a pricing objection trend.").
    *   If possible, quantify observations (e.g., percentages, counts, averages from the sample).
5.  **Performance Trends (from 'fileContent')**: Based on your findings from 'fileContent', describe any 'performanceTrends'. If 'fileContent' lacks a time dimension or comparative aspect, state this limitation clearly. Mention if specific KPIs (e.g., AHT, Conversion Rate) can be estimated from the sample and what they indicate.
6.  **Strengths & Improvements (from 'fileContent')**: 'areasOfStrength' and 'areasForImprovement' MUST be directly supported by insights derived from 'fileContent'. Be specific and analytical.
7.  **Actionable Recommendations (from 'fileContent')**: 'actionableRecommendations' MUST be concrete, strategic, and directly linked to your findings from 'fileContent'. Suggest specific actions.
8.  **Data Sample**: If 'fileContent' appears tabular, include a small 'extractedDataSample' (headers and first 2-3 rows) as plain text.
9.  **Limitations**: In 'limitationsAcknowledged', clearly state that analysis is based on the provided 'fileContent' (potentially a sample). If 'fileContent' is sparse, unstructured, or doesn't clearly contain telecalling operational data, explain how this limits the depth of analysis. Assess data quality if possible from the sample (e.g., missing values, inconsistent formats). If you cannot confidently derive telecalling insights, state this clearly.

{{else}}
INSTRUCTIONS FOR HYPOTHETICAL ANALYSIS (Binary Files like DOCX, XLSX, PDF, or if text content was not provided):
The 'fileContent' for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct AI parsing.
Your analysis will be a **SOPHISTICATED HYPOTHETICAL ANALYSIS**, based **solely on the 'fileName', 'fileType', and the '{{{userDescription}}}'**. Emulate how a top-tier analyst would strategize about this file.

1.  Generate an 'analysisTitle' appropriate for a sophisticated hypothetical analysis of '{{{fileName}}}'.
2.  **Data Overview & Structure (Advanced Hypothetical for Telecalling)**:
    *   Based on '{{{fileName}}}', '{{{fileType}}}", and '{{{userDescription}}}', describe what kind of telecalling-specific data this file *would ideally contain for advanced analysis*.
    *   **Specifically for Excel files ({{{fileType}}} contains 'spreadsheetml' or 'ms-excel'):**
        *   State: "Given '{{{fileName}}}' is an Excel file, for robust telecalling analysis, one would expect structured data across one or more sheets such as:"
        *   Hypothesize DETAILED sheet names relevant to telecalling data (e.g., 'Agent_Performance_Dashboard', 'Detailed_Call_Logs', 'Sales_Funnel_Data', 'Campaign_Effectiveness_Tracker', 'Lead_Management_System_Export').
        *   For AT LEAST TWO key hypothesized sheets (e.g., 'Detailed_Call_Logs' and 'Agent_Performance_Dashboard'), list COMPREHENSIVE potential column headers.
            *   For 'Detailed_Call_Logs': 'Call_ID', 'Agent_ID', 'Agent_Name', 'Customer_ID', 'Call_Start_Timestamp', 'Call_End_Timestamp', 'Call_Duration_Seconds', 'Call_Outcome (e.g., Sale, No Sale, Follow-up, Lead Generated, Wrong Number)', 'Product_Pitched', 'Lead_Source', 'Notes_Transcription_Summary_ID', 'Dialed_Number', 'Call_Direction (Inbound/Outbound)', 'Wrap_Up_Time_Seconds'.
            *   For 'Agent_Performance_Dashboard': 'Agent_ID', 'Agent_Name', 'Date', 'Total_Calls_Made', 'Total_Talk_Time_Minutes', 'Average_Handle_Time_Minutes (AHT)', 'Sales_Closed_Count', 'Total_Revenue_Generated', 'Conversion_Rate_Percent (Sales/Contacts)', 'Calls_Per_Hour', 'First_Call_Resolution_Rate_Percent', 'Customer_Satisfaction_Score_Avg (CSAT)'.
        *   Explain HOW these hypothesized structures would enable advanced telecalling performance analysis. For instance, "Such a structure would allow for calculating agent-specific conversion rates, AHT, identifying peak call times, correlating lead sources with outcomes, and performing trend analysis on sales performance."
    *   For other binary files (DOCX, PDF), describe the type of strategic information they might hold related to telecalling (e.g., sales playbooks, competitor analysis reports, detailed performance review documents in PDF format, marketing campaign summaries).
3.  **Key Observations & Findings (Minimum 2-5 *sophisticated, potential* insights linked to User's Goal and Hypothesized Structure)**:
    *   These are HYPOTHETICAL but must be ANALYTICAL and STRATEGIC. Each finding in 'keyObservationsAndFindings' MUST be a *plausible, deep insight* that *could* be derived IF data matching the '{{{fileName}}}', your hypothesized structure (especially for Excel), and the '{{{userDescription}}}' were present and analyzed.
    *   **Directly link your potential findings to the user's goal ('{{{userDescription}}}') and the hypothesized data structure (e.g., specific columns or sheets you mentioned above for Excel).**
    *   Frame these conditionally and analytically: "If the 'Agent_Performance_Dashboard' sheet contains 'Conversion_Rate_Percent' and 'Total_Training_Hours' (a column you might suggest adding), and the user's goal is to 'improve conversion rates', one *could analyze the correlation between training hours and conversion rates, potentially finding* that agents with >10 hours of recent product training exhibit a 15% higher conversion rate. This would suggest X."
    *   **Example for an XLSX named 'Q1_Telecalling_Data.xlsx' with user goal 'identify top performing agents'**:
        *   "Given the goal to identify top agents, and assuming 'Q1_Telecalling_Data.xlsx' has an 'Agent_Performance_Dashboard' sheet with 'Agent_Name', 'Total_Sales_Value', 'Conversion_Rate_Percent', and 'CSAT_Avg' columns, a *key potential observation might involve creating a composite performance score*. For instance, one could weigh conversion rate (50%), sales value (30%), and CSAT (20%) to identify truly top-performing agents holistically, rather than relying on a single metric. Agent Priya, despite lower sales volume, might emerge as a top performer due to high conversion and CSAT." (GOOD POTENTIAL INSIGHT - links to goal, hypothesized Excel structure, and suggests an analytical approach)
    *   If '{{{userDescription}}}' hints at specific data (e.g., "analyze regional sales performance"), make your hypothetical findings reflect that, using your hypothesized Excel structure and suggesting analytical methods.
4.  **Performance Trends (Potential & Analytical)**: Describe *potential* 'performanceTrends' such an Excel file could reveal, suggesting analytical methods. (e.g., "If 'Detailed_Call_Logs' includes timestamps, month-over-month changes in 'Call_Duration_Seconds' or 'Sales_Closed_Count' could be trended. A potential trend might be an increase in AHT during Q3, which could be investigated for causes like new system rollouts or complex customer queries.").
5.  **Strengths & Improvements (Potential & Analytical)**: Suggest *potential* 'areasOfStrength' and 'areasForImprovement' one might uncover through analysis of the hypothesized data. Frame these analytically.
6.  **Actionable Recommendations (Potential & Strategic)**: Provide 'actionableRecommendations' that would typically follow from such hypothetical findings for a telecalling team. These should be specific and strategic. (e.g., "If analysis of a hypothesized 'Call_Outcome' and 'Lead_Source' in Excel reveals that leads from 'Webinar' source have a 50% lower conversion rate, recommend re-evaluating webinar targeting or follow-up scripts.").
7.  State in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL and STRATEGIC. It is based on the file's name, type, and the user's description, as the actual content of this binary file was not processed by the AI. Insights reflect potential findings one might expect from a deep analysis of such files in a telecalling context, assuming the data is structured as robustly hypothesized. The user would need to perform the actual data extraction and analysis using appropriate tools."
8.  Suggest 'suggestedNextSteps' for the user to perform their own analysis. For Excel: "User should open '{{{fileName}}}' and verify if the hypothesized sheets/columns (e.g., 'Detailed_Call_Logs' with 'Call_Duration_Seconds', 'Agent_Performance_Dashboard' with 'Conversion_Rate_Percent') exist. If so, they can use Excel's Power Query for data cleaning, Pivot Tables for summarization, and Charts for visualization to explore the actual data based on these potential insights. Statistical functions or add-ins could be used for deeper correlation analysis."
9.  Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format.
Your primary goal for text-based content is to provide a deep, insightful analysis directly from the provided data sample. For binary files, provide a robust, STRATEGIC, and *telecalling-focused* hypothetical analysis with specific examples of potential data structures, analytical methods, and insights related to the user's goal.
`,
});

const dataAnalysisFlow = ai.defineFlow(
  {
    name: 'dataAnalysisFlow',
    inputSchema: DataAnalysisInputSchema,
    outputSchema: DataAnalysisOutputSchema,
  },
  async (input: DataAnalysisInput): Promise<DataAnalysisOutput> => {
    let processedInput = {...input};
    const isTextBased = input.fileType === 'text/csv' || input.fileType === 'text/plain';
    let originalContentLength = 0;

    if (!isTextBased || !input.fileContent) { 
      processedInput.fileContent = undefined; 
    } else if (input.fileContent) { 
      originalContentLength = input.fileContent.length;
      // Truncation is handled client-side before calling this flow
    }

    const {output} = await dataAnalysisPrompt(processedInput);
    
    if (!output) {
      console.error("Data analysis flow: Prompt returned null output for input:", processedInput.fileName);
      const defaultLimitations = !processedInput.fileContent 
        ? `Analysis of ${input.fileName} (${input.fileType}) was based on metadata as full content was not processed. This is a hypothetical analysis.`
        : `Analysis based on the initial part of the text content of ${input.fileName}.`;
      return {
        analysisTitle: `Error Analyzing ${processedInput.fileName}`,
        dataOverview: "The AI analysis process encountered an error and could not provide an overview.",
        keyObservationsAndFindings: ["Analysis incomplete due to an error.", "The AI failed to generate specific findings."],
        performanceTrends: "N/A due to analysis error.",
        areasOfStrength: [],
        areasForImprovement: [],
        actionableRecommendations: ["Resolve AI analysis error to get recommendations."],
        limitationsAcknowledged: `AI analysis failed. ${defaultLimitations}`,
        suggestedNextSteps: ["Review input data and prompt configuration if the error persists."],
        extractedDataSample: undefined,
      };
    }
    
    // Ensure limitations are sensible if AI misses them
    if (!output.limitationsAcknowledged) {
        if (!processedInput.fileContent) { 
            output.limitationsAcknowledged = `The analysis for '${input.fileName}' (${input.fileType}) is HYPOTHETICAL and STRATEGIC. It is based on the file's name, type, and the user's description, as the actual content of this binary file was not processed by the AI. Insights reflect potential findings one might expect from a deep analysis of such files in a telecalling context, assuming the data is structured as robustly hypothesized. The user would need to perform the actual data extraction and analysis using appropriate tools.`;
            output.extractedDataSample = undefined; 
        } else if (processedInput.fileContent){ 
            let limitationText = `Analysis based on the provided text content (up to the first ${processedInput.fileContent.length} characters) of '${input.fileName}'.`;
            if (originalContentLength > processedInput.fileContent.length) { 
                limitationText += ` The original file content was longer (${originalContentLength} characters) and was effectively truncated for this analysis.`;
            }
            if (!output.extractedDataSample) {
                 limitationText += " No clear simple table structure was identified for sample extraction in the initial content, or it was not deemed relevant by the AI.";
            }
            output.limitationsAcknowledged = limitationText;
        }
    }
    if (processedInput.fileContent && !output.extractedDataSample && !output.limitationsAcknowledged.includes("No clear simple table structure")) {
        output.extractedDataSample = "(No simple tabular data snippet was extracted by the AI for this text file, or it focused on other analysis aspects.)";
    }
    if (!processedInput.fileContent) { 
        output.extractedDataSample = undefined;
    }

    return output;
  }
);


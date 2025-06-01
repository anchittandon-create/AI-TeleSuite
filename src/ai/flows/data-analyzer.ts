
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
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings. For text-based files, these MUST be directly derived from the provided 'fileContent'. For binary files, these are HYPOTHETICAL based on metadata, user description, and hypothesized data structures (especially for Excel). Each finding MUST be an INSIGHT or CONCLUSION (e.g., 'Agent Smith exhibited a 15% higher conversion rate for Product Y compared to other agents in this dataset.') NOT just a data point (e.g., 'The data contains Agent Smith and Product Y')."),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed (or potential trends for binary files, linked to hypothesized data). Example: 'An upward trend in evening shift conversion rates was observed over the past month based on call outcomes.' or 'A potential trend for a file named 'quarterly_sales.xlsx' could be seasonal variations in sales if time-series data is present.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance is strong (or potentially strong for binary files), based on the data insights or hypothesized data."),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved (or potentially improved for binary files), supported by data insights or hypothesized data."),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team (or potential recommendations for binary files) based on the analysis and hypothesized data."),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis (e.g., analysis based on partial content for large text files, HYPOTHETICAL analysis for binary files due to no direct content access, inability to perform deep statistical analysis due to data structure or lack of clear telecalling operational data)."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggestions for further analysis or actions (e.g., 'Correlate call duration with sales outcomes using a larger dataset.', 'Analyze sentiment in call notes for agents with low conversion rates.')."),
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
  prompt: `You are an expert Telecalling Performance Data Analyst. Your primary function is to **extract actionable business insights** from telecalling-related data.

File Name: {{{fileName}}}
File Type: {{{fileType}}}
User's Goal/Description for Analysis: {{{userDescription}}}

{{#if fileContent}}
INSTRUCTIONS FOR ANALYZING PROVIDED TEXT CONTENT (CSV/TXT):
The 'fileContent' below is from a text-based file (e.g., CSV, TXT). It might be a sample (e.g., first 10,000 characters) of a larger file.
Your analysis MUST be based **DIRECTLY on this provided 'fileContent'**.

Data Content (from CSV/TXT file - this is the data you MUST analyze):
\`\`\`
{{{fileContent}}}
\`\`\`
1.  **Role**: Act as a Data Analyst. Your goal is to **INTERPRET** this data, not just describe it.
2.  **Column Inference**: Attempt to infer potential column headers if they are not explicit. Look for columns that might represent: 'Agent Name', 'Call Date/Time', 'Call Duration (seconds/minutes)', 'Call Outcome (e.g., Sale, No Sale, Follow-up, Lead Generated)', 'Product Pitched', 'Customer ID/Region', 'Lead Source', 'Call Script Adherence Score', 'Customer Sentiment Score', 'Reason for No Sale', 'Notes/Feedback Text'.
3.  **Analysis Focus**: Generate an 'analysisTitle'. Provide a 'dataOverview' describing the data from a telecalling performance perspective based on the 'fileContent'.
4.  **Key Observations & Findings (Minimum 2-5 detailed insights from 'fileContent')**:
    *   This is the MOST CRITICAL part. Each finding in 'keyObservationsAndFindings' MUST be a specific, data-driven **insight or conclusion directly from the 'fileContent'**.
    *   **DO NOT** just list data points or describe what columns exist (e.g., "The data shows columns for Agent, Product, and Outcome." is BAD).
    *   **DO** look for patterns, correlations, anomalies, or comparisons within the 'fileContent'. Examples:
        *   "Agent X has a 20% higher 'Sale' outcome for 'Product Y' calls compared to other agents *in this dataset sample*." (GOOD INSIGHT)
        *   "Calls lasting over 5 minutes *in this sample* have a 30% lower conversion rate than calls under 3 minutes." (GOOD INSIGHT)
    *   If '{{{userDescription}}}' provides a goal, focus findings towards it using the 'fileContent'.
    *   If text fields (like notes) in 'fileContent' seem to contain customer feedback, attempt a qualitative sentiment assessment and include it (e.g., "A high number of 'Notes' entries for 'Product Z' in this sample mention 'too expensive', suggesting a pricing objection trend.").
5.  **Performance Trends (from 'fileContent')**: Based on your findings from 'fileContent', describe any 'performanceTrends'. If 'fileContent' lacks a time dimension or comparative aspect, state this limitation.
6.  **Strengths & Improvements (from 'fileContent')**: 'areasOfStrength' and 'areasForImprovement' MUST be directly supported by insights derived from 'fileContent'. Be specific.
7.  **Actionable Recommendations (from 'fileContent')**: 'actionableRecommendations' MUST be concrete and directly linked to your findings from 'fileContent'.
8.  **Data Sample**: If 'fileContent' appears tabular, include a small 'extractedDataSample' (headers and first 2-3 rows) as plain text.
9.  **Limitations**: In 'limitationsAcknowledged', clearly state that analysis is based on the provided 'fileContent' (potentially a sample). If 'fileContent' is sparse, unstructured, or doesn't clearly contain telecalling operational data, explain how this limits the depth of analysis. If you cannot confidently derive telecalling insights from 'fileContent', state this clearly.

{{else}}
INSTRUCTIONS FOR HYPOTHETICAL ANALYSIS (Binary Files like DOCX, XLSX, PDF, or if text content was not provided):
The 'fileContent' for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct AI parsing because it's a binary file type or its content was not provided.
Your analysis will be **HYPOTHETICAL**, based **solely on the 'fileName', 'fileType', and the '{{{userDescription}}}'**.

1.  Generate an 'analysisTitle' appropriate for a hypothetical analysis of '{{{fileName}}}'.
2.  **Data Overview & Structure (Hypothetical for Telecalling)**:
    *   Based on '{{{fileName}}}', '{{{fileType}}}", and '{{{userDescription}}}', describe what kind of telecalling-specific data this file *might typically contain*.
    *   **Specifically for Excel files ({{{fileType}}} contains 'spreadsheetml' or 'ms-excel'):**
        *   Start by stating: "Given that '{{{fileName}}}' is an Excel file, it likely contains structured data in one or more sheets."
        *   Hypothesize potential sheet names relevant to telecalling data (e.g., 'Agent Performance', 'Call Logs', 'Sales Records', 'Campaign Data', 'Lead List').
        *   For a couple of these hypothesized sheets (e.g., 'Agent Performance' and 'Call Logs'), list potential column headers that would be common in a telecalling context. For 'Agent Performance', consider columns like: 'Agent ID', 'Agent Name', 'Date', 'Calls Made', 'Talk Time (Total)', 'Sales Closed', 'Revenue Generated', 'Conversion Rate (%)', 'Average Handle Time (AHT)'. For 'Call Logs', consider: 'Call ID', 'Agent ID', 'Customer ID', 'Call Start Time', 'Call End Time', 'Call Duration', 'Call Outcome (e.g., Sale, No Answer, Follow-up)', 'Product Discussed', 'Lead Source', 'Call Notes/Summary'.
        *   Briefly explain how these hypothesized structures (sheets and columns) would be used to track and analyze telecalling performance. For instance, "Such a structure would allow for tracking individual agent productivity, call outcomes, and sales effectiveness over time."
    *   For other binary files (DOCX, PDF), describe the type of information they might hold related to telecalling (e.g., sales scripts, training manuals, policy documents, monthly performance reports in PDF format).
3.  **Key Observations & Findings (Minimum 2-5 *potential* insights related to User's Goal)**:
    *   These are HYPOTHETICAL. Each finding in 'keyObservationsAndFindings' MUST be a *plausible insight* that *could* be derived IF data matching the '{{{fileName}}}', your hypothesized structure (especially for Excel), and the '{{{userDescription}}}' were present and analyzed.
    *   **Directly link your potential findings to the user's goal ('{{{userDescription}}}') and the hypothesized data structure (e.g., specific columns or sheets you mentioned above for Excel).**
    *   Frame these conditionally: "If the 'Agent Performance' sheet contains a 'Conversion Rate' column, and the user's goal is to 'improve conversion rates', one *might observe* that agents who attended recent product training have a 10% higher conversion rate." or "Given the user goal to 'reduce call drops', if the 'Call Logs' sheet has a 'Call Outcome' column showing 'Dropped by Customer' and a 'Call Stage' column, a *potential finding could be* that a significant number of calls are dropped during the pricing discussion stage."
    *   **Example for an XLSX named 'Q1_Telecalling_Data.xlsx' with user goal 'identify top performing agents'**:
        *   "Given the goal to identify top agents, and assuming 'Q1_Telecalling_Data.xlsx' has an 'Agent Performance' sheet with 'Agent Name', 'Total Sales Value', and 'Number of Sales' columns, a *key potential observation might be* that 'Agent Priya' has the highest 'Total Sales Value', while 'Agent Ramesh' has the highest 'Number of Sales', suggesting different aspects of top performance. Further analysis of 'Conversion Rate' (if present) would be needed to understand efficiency." (GOOD POTENTIAL INSIGHT - links to goal and hypothesized Excel structure)
        *   "If the Excel file also contains a 'Customer Satisfaction Score' (CSAT) column per agent, one *might find* that some top-selling agents have lower CSAT scores, indicating a need to balance sales aggression with customer experience." (GOOD POTENTIAL INSIGHT)
    *   If '{{{userDescription}}}' hints at specific data (e.g., "analyze regional sales performance"), make your hypothetical findings reflect that, using your hypothesized Excel structure.
4.  **Performance Trends (Potential)**: Describe *potential* 'performanceTrends' that such an Excel file could reveal (e.g., month-over-month changes in 'Calls Made' or 'Sales Closed' if the hypothesized sheets contain date-related columns). Link these trends to the user's goal if possible.
5.  **Strengths & Improvements (Potential)**: Suggest *potential* 'areasOfStrength' and 'areasForImprovement' one might uncover. For Excel, link these to the hypothesized data (e.g., "Potential Strength: If 'First Call Resolution' rates are consistently above 80% in an 'Agent Performance' sheet, this is a strength." "Potential Improvement: If 'Average Handle Time' for agents in a specific campaign is 20% above target, this is an area for improvement.").
6.  **Actionable Recommendations (Potential)**: Provide 'actionableRecommendations' that would typically follow from such hypothetical findings for a telecalling team. These should be specific. (e.g., "If analysis of a hypothesized 'Call Outcome' column shows many 'Not Interested' after initial pitch, recommend revising the opening script or targeting.").
7.  State in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL. It is based on the file's name, type, and the user's description, as the actual content of this binary file was not processed by the AI. Insights reflect potential findings one might expect in such files for telecalling analysis, assuming the data is structured as hypothesized."
8.  Suggest 'suggestedNextSteps' for the user to perform their own analysis of the file using tools like Excel or data analysis software (e.g., "User should open the Excel file and verify if the hypothesized sheets/columns exist. Then, they can use Excel's pivot tables or charting features to explore the actual data based on these potential insights.").
9.  Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format.
Your primary goal for text-based content is to provide a deep, insightful analysis directly from the provided data sample. For binary files, provide a robust and *telecalling-focused* hypothetical analysis with specific examples of potential data structures and insights related to the user's goal.
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
      // Truncation is handled client-side before calling this flow, but this is a safeguard.
      if (originalContentLength > 10000) { 
        // console.warn(`DataAnalysisFlow: fileContent for ${input.fileName} might have been pre-truncated. Length received: ${input.fileContent.length}. Original reported (if applicable): ${originalContentLength}`);
        // No re-truncation here as it's expected to be done client-side.
      }
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
            output.limitationsAcknowledged = `The analysis for '${input.fileName}' (${input.fileType}) is HYPOTHETICAL. It is based on the file's name, type, and the user's description, as the actual content of this binary file was not processed by the AI. Insights reflect potential findings one might expect in such files for telecalling analysis, assuming the data is structured as hypothesized.`;
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


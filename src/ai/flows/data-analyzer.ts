
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
  dataOverview: z.string().describe("A brief description of the data analyzed (or hypothesized data for binary files) and its relevance to telecalling performance (e.g., 'Analysis of call logs from March, focusing on call duration and outcomes.')."),
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings. For text-based files, these MUST be directly derived from the provided 'fileContent'. For binary files, these are HYPOTHETICAL based on metadata and user description. Each finding MUST be an INSIGHT or CONCLUSION (e.g., 'Agent Smith exhibited a 15% higher conversion rate for Product Y compared to other agents in this dataset.') NOT just a data point (e.g., 'The data contains Agent Smith and Product Y')."),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed (or potential trends for binary files). Example: 'An upward trend in evening shift conversion rates was observed over the past month based on call outcomes.' or 'A potential trend for a file named 'quarterly_sales.xlsx' could be seasonal variations in sales.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance is strong (or potentially strong for binary files), based on the data insights. Example: 'High first-call resolution rates for inquiries about Product Z.'"),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved (or potentially improved for binary files), supported by data insights. Example: 'Average call duration for declined sales is 30% longer than for successful sales, suggesting potential for more efficient objection handling.'"),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team (or potential recommendations for binary files) based on the analysis. Example: 'Implement targeted coaching for agents with call durations significantly above average for Product X.'"),
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
The 'fileContent' for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct AI parsing because it's a binary file type (e.g., DOCX, XLSX, PDF) or its content was not provided.
Your analysis will be **HYPOTHETICAL**, based **solely on the 'fileName', 'fileType', and the '{{{userDescription}}}'**.

1.  Generate an 'analysisTitle' appropriate for a hypothetical analysis of '{{{fileName}}}'.
2.  Provide a 'dataOverview' describing what kind of telecalling data such a file *might typically* contain, guided by its name, type, and user description.
3.  List at least 2-5 *potential* 'keyObservationsAndFindings' that *could* be derived IF data matching the '{{{fileName}}}' and '{{{userDescription}}}' were present. Frame these hypothetically. Example: "If '{{{fileName}}}' (e.g., 'quarterly_agent_performance.xlsx') contains monthly sales figures per agent as described by the user, we might observe a trend of increasing overall sales during Q3."
4.  Describe *potential* 'performanceTrends' that could emerge from such data.
5.  Suggest *potential* 'areasOfStrength' and 'areasForImprovement' one might find.
6.  Provide 'actionableRecommendations' that would typically follow from such hypothetical findings.
7.  State in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL. It is based on the file's name, type, and the user's description, as the actual content of this file was not processed by the AI. Insights reflect typical data or potential findings one might expect in such files for telecalling analysis."
8.  Suggest 'suggestedNextSteps' for the user to perform their own analysis of the file.
9.  Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format.
Your primary goal for text-based content is to provide a deep, insightful analysis directly from the provided data sample, not just superficial descriptions. For binary files, provide a robust hypothetical analysis.
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

    if (!isTextBased || !input.fileContent) { // If not text-based OR if fileContent is missing (e.g. error reading it)
      processedInput.fileContent = undefined; // Ensure it's undefined for the prompt's {{#if fileContent}} logic
    } else if (input.fileContent) { // It is text-based and has content
      originalContentLength = input.fileContent.length;
      // The truncation is already handled in the form before calling this flow,
      // but as a safeguard or if called directly:
      if (originalContentLength > 10000) { 
        // console.warn(`DataAnalysisFlow: fileContent for ${input.fileName} was truncated from ${originalContentLength} to 10000 chars for AI prompt.`);
        // processedInput.fileContent = input.fileContent.substring(0, 10000); 
        // Assuming MAX_TEXT_CONTENT_LENGTH from form is 10000, so this re-truncation might not be needed if form is source.
      }
    }

    const {output} = await dataAnalysisPrompt(processedInput);
    
    if (!output) {
      console.error("Data analysis flow: Prompt returned null output for input:", processedInput.fileName);
      const defaultLimitations = !processedInput.fileContent // Check processedInput here
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
        if (!processedInput.fileContent) { // If it was a binary file or text file whose content couldn't be read
            output.limitationsAcknowledged = `The analysis for '${input.fileName}' (${input.fileType}) is HYPOTHETICAL. It is based on the file's name, type, and the user's description, as the actual content of this file was not processed by the AI. Insights reflect typical data or potential findings one might expect in such files for telecalling analysis.`;
            output.extractedDataSample = undefined; // Ensure no sample for hypothetical
        } else if (processedInput.fileContent){ // If text content was processed
            let limitationText = `Analysis based on the provided text content (up to the first ${processedInput.fileContent.length} characters) of '${input.fileName}'.`;
            if (originalContentLength > processedInput.fileContent.length) { // Check if original was longer than what was processed
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
    if (!processedInput.fileContent) { // Double ensure no sample for non-content analysis
        output.extractedDataSample = undefined;
    }


    return output;
  }
);


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
  fileType: z.string().describe("The MIME type of the file (e.g., 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')."),
  fileContent: z.string().optional().describe("The text content of the file, if it's a text-based format like CSV or TXT. This is the primary data for analysis (e.g., first 10000 characters or a representative sample). For binary files like DOCX/XLSX, this will be empty."),
  userDescription: z.string().optional().describe("A user-provided description of the data or the specific analysis goal related to telecalling performance (e.g., 'Analyze agent conversion rates and call durations from this Q1 call log CSV.')."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const DataAnalysisOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise title for the performance analysis (e.g., 'Telecalling Performance Analysis: Q3 Sales Data')."),
  dataOverview: z.string().describe("A brief description of the data analyzed (or hypothesized data for binary files) and its relevance to telecalling performance (e.g., 'Analysis of call logs from March, focusing on call duration and outcomes.')."),
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings directly derived from the provided data if available, or hypothetically based on metadata. Each finding MUST be an INSIGHT or CONCLUSION (e.g., 'Agent Smith exhibited a 15% higher conversion rate for Product Y compared to other agents in this dataset.') NOT just a data point (e.g., 'The data contains Agent Smith and Product Y')."),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed in the data (or potential trends for binary files). Example: 'An upward trend in evening shift conversion rates was observed over the past month based on call outcomes.' or 'A potential trend to investigate would be call handle time variations across different products.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance is strong based on the data insights. Example: 'High first-call resolution rates for inquiries about Product Z.'"),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved, supported by data insights. Example: 'Average call duration for declined sales is 30% longer than for successful sales, suggesting potential for more efficient objection handling.'"),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team based on the analysis. Example: 'Implement targeted coaching for agents with call durations significantly above average for Product X.'"),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis (e.g., analysis based on partial content for large text files, hypothetical analysis for binary files, inability to perform deep statistical analysis due to data structure or lack of clear telecalling operational data)."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggestions for further analysis or actions (e.g., 'Correlate call duration with sales outcomes using a larger dataset.', 'Analyze sentiment in call notes for agents with low conversion rates.')."),
  extractedDataSample: z.string().optional().describe("If a simple table structure was detected in text-based content (like CSV), a small sample of that data (e.g., first few rows as text) that was used for analysis. This is plain text, not a formatted table object."),
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
Data Content (from CSV/TXT file - this is the data you MUST analyze, potentially a sample/truncated part of a larger file, max ~10,000 characters):
\`\`\`
{{{fileContent}}}
\`\`\`
Instructions for analyzing the provided 'fileContent':
1.  **Role**: Act as a Data Analyst. Your goal is to **INTERPRET** this data, not just describe it.
2.  **Column Inference**: Attempt to infer potential column headers if they are not explicit. Look for columns that might represent: 'Agent Name', 'Call Date/Time', 'Call Duration (seconds/minutes)', 'Call Outcome (e.g., Sale, No Sale, Follow-up, Lead Generated)', 'Product Pitched', 'Customer ID/Region', 'Lead Source', 'Call Script Adherence Score', 'Customer Sentiment Score', 'Reason for No Sale', 'Notes/Feedback Text'.
3.  **Analysis Focus**: Generate an 'analysisTitle'. Provide a 'dataOverview' describing the data from a telecalling performance perspective.
4.  **Key Observations & Findings (Minimum 2-5 detailed insights)**:
    *   This is the MOST CRITICAL part. Each finding in 'keyObservationsAndFindings' MUST be a specific, data-driven **insight or conclusion**.
    *   **DO NOT** just list data points or describe what columns exist.
    *   **DO** look for patterns, correlations, anomalies, or comparisons. Examples:
        *   "Agent X has a 20% higher 'Sale' outcome for 'Product Y' calls compared to other agents in this dataset." (GOOD INSIGHT)
        *   "Calls lasting over 5 minutes have a 30% lower conversion rate than calls under 3 minutes." (GOOD INSIGHT)
        *   "The data shows columns for Agent, Product, and Outcome." (BAD - This is descriptive, not an insight)
    *   If '{{{userDescription}}}' provides a goal, focus findings towards it.
    *   If text fields (like notes) seem to contain customer feedback, attempt a qualitative sentiment assessment and include it in your findings (e.g., "A high number of 'Notes' entries for 'Product Z' mention 'too expensive', suggesting a pricing objection trend.").
5.  **Performance Trends**: Based on your findings, describe any 'performanceTrends' in a narrative. If data lacks a time dimension or comparative aspect, state this limitation. Example: "An upward trend in conversion rates for leads from 'Lead Source A' was observed compared to 'Lead Source B'."
6.  **Strengths & Improvements**: 'areasOfStrength' and 'areasForImprovement' MUST be directly supported by your derived insights. Be specific. Example Strength: "Consistently short average call durations for 'Agent C' on successfully closed sales indicates efficiency." Example Improvement: "The 'Follow-up' call outcome constitutes 40% of calls for 'Product A', suggesting a need to improve first-call resolution strategies for this product."
7.  **Actionable Recommendations**: 'actionableRecommendations' MUST be concrete and directly linked to your findings. Example: "If Agent X has higher success with Product Y, consider having Agent X share best practices with the team for Product Y."
8.  **Data Sample**: If 'fileContent' appears tabular, include a small 'extractedDataSample' (headers and first 2-3 rows) as plain text.
9.  **Limitations**: In 'limitationsAcknowledged', clearly state that analysis is based on the provided 'fileContent' (potentially a sample). If the data is sparse, unstructured, or doesn't clearly contain telecalling operational data (e.g., agent names, call outcomes, durations), explain how this limits the depth of analysis. If you cannot confidently derive telecalling insights, state this.
10. **Next Steps**: Suggest 'suggestedNextSteps' for further investigation based on THIS analysis.

{{else}}
File Content for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct parsing because it's a binary file (e.g., DOCX, XLSX, PDF) or was too large/unreadable. Your analysis will be HYPOTHETICAL.
Instructions for HYPOTHETICAL analysis based on metadata (filename, file type, user description):
1.  Generate an 'analysisTitle' appropriate for a hypothetical analysis of '{{{fileName}}}'.
2.  Provide a 'dataOverview' describing what kind of telecalling data such a file *might typically* contain.
3.  List at least 2-5 *potential* 'keyObservationsAndFindings' that *could* be derived IF data matching the description were present. Frame these hypothetically. Example: "If '{{{fileName}}}' contains monthly sales figures per agent, we might observe a trend of increasing overall sales during Q3."
4.  Describe *potential* 'performanceTrends'.
5.  Suggest *potential* 'areasOfStrength' and 'areasForImprovement'.
6.  Provide 'actionableRecommendations' that would typically follow.
7.  State in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL, based on its name, type, and the user's description. The actual content of this file was not processed. Insights reflect typical data found in such files for telecalling analysis."
8.  Suggest 'suggestedNextSteps'.
9.  Do NOT include 'extractedDataSample'.
{{/if}}

Output the entire analysis in the specified JSON format. Your primary goal for text-based content is to provide a deep, insightful analysis directly from the provided data, not just superficial descriptions.
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
    const isTextBased = input.fileType.startsWith('text/') || input.fileType === 'application/csv';
    let originalContentLength = 0;

    if (!isTextBased || !input.fileContent) {
      processedInput.fileContent = undefined; // Ensure it's undefined for the prompt logic
    } else if (input.fileContent) {
      originalContentLength = input.fileContent.length;
      if (originalContentLength > 10000) { // Keep the analysis limit
        processedInput.fileContent = input.fileContent.substring(0, 10000);
      }
    }

    const {output} = await dataAnalysisPrompt(processedInput);
    
    if (!output) {
      console.error("Data analysis flow: Prompt returned null output for input:", processedInput.fileName);
      const defaultLimitations = !isTextBased || !input.fileContent 
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
        if (!isTextBased || !processedInput.fileContent) {
            output.limitationsAcknowledged = `The analysis for '${input.fileName}' (${input.fileType}) is HYPOTHETICAL, based on its name, type, and the user's description. The actual content of this binary file was not processed. Insights reflect typical data found in such files for telecalling analysis. Table sample extraction not possible.`;
        } else if (processedInput.fileContent){
            let limitationText = `Analysis based on the provided text content (first ${processedInput.fileContent.length} characters) of '${input.fileName}'.`;
            if (originalContentLength > 10000) {
                limitationText += ` The original file content was longer (${originalContentLength} characters) and was truncated for this analysis.`;
            }
            if (!output.extractedDataSample) {
                 limitationText += " No clear simple table structure was identified for sample extraction in the initial content, or it was not deemed relevant by the AI.";
            }
            output.limitationsAcknowledged = limitationText;
        }
    }
    if (isTextBased && processedInput.fileContent && !output.extractedDataSample && !output.limitationsAcknowledged.includes("No clear simple table structure")) {
        // Add a default if AI analyzed text but didn't extract a sample and didn't mention why
        output.extractedDataSample = "(No simple tabular data snippet was extracted by the AI for this text file, or it focused on other analysis aspects.)";
    }

    return output;
  }
);
    

    

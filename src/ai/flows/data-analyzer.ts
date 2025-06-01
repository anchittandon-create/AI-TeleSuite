
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
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings directly derived from the provided data if available, or hypothetically based on metadata. Each finding should be an insight or conclusion, not just a data point. Example: 'Agent Smith exhibited the highest call volume with an average call duration of 3.5 minutes, correlating with a 15% higher conversion rate in this dataset.' or 'If this sheet contains agent scores, we might observe varying performance levels.'"),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed in the data (or potential trends for binary files). Example: 'There is an upward trend in conversion rates during evening shifts over the past month based on the provided data.' or 'A potential trend to look for would be changes in average handle time over quarterly periods.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where the telecalling performance is strong based on the data (or could be strong). Example: 'High overall customer satisfaction scores reported in feedback column.'"),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved, supported by data insights (or potential areas for improvement). Example: 'Call abandonment rate increases significantly after 2 minutes on hold.'"),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team based on the analysis (or typical recommendations). Example: 'Implement targeted coaching for agents with significantly lower conversion rates on product X.'"),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis (e.g., analysis based on partial content for large text files, or hypothetical analysis for binary files where full content wasn't processed, or inability to perform deep statistical analysis due to data structure)."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggestions for further analysis or actions (e.g., 'Deep dive into Agent X's call handling techniques.', 'Visualize conversion rates by time of day.', 'Correlate call duration with sales outcomes using a larger dataset.')."),
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
  prompt: `You are an expert Telecalling Performance Data Analyst. Your task is to conduct a detailed analysis based on the provided information.

File Name: {{{fileName}}}
File Type: {{{fileType}}}
User's Goal/Description for Analysis: {{{userDescription}}}

{{#if fileContent}}
Data Content (from CSV/TXT file - this is the data you MUST analyze, potentially a sample/truncated part of a larger file, max ~10,000 characters):
\`\`\`
{{{fileContent}}}
\`\`\`
Instructions for analyzing the provided 'fileContent':
1.  **Act as a Data Analyst**: Your primary goal is to INTERPRET this data, not just describe it. Identify potential columns/fields related to telecalling (e.g., agent names, call dates, call durations, outcomes like 'sale' or 'no_sale', products pitched, customer feedback text).
2.  **Generate an 'analysisTitle'** reflecting the analysis of '{{{fileName}}}'.
3.  **Provide a 'dataOverview'** specific to the 'fileContent'. Describe what data is present and how it relates to telecalling performance based on your interpretation.
4.  **List at least 2-5 detailed 'keyObservationsAndFindings'**: These MUST be INSIGHTS or CONCLUSIONS derived directly from the 'fileContent'. Do not just list data points.
    *   Example insight: "Agent A shows a 20% higher success rate on Product X calls compared to other agents in this dataset." (NOT: "Data shows Agent A, Product X, and success rates.")
    *   Look for variations, correlations (even if qualitative), or notable points. If '{{{userDescription}}}' provides a goal, focus findings towards it.
5.  **Describe any 'performanceTrends'**: If the data has a temporal aspect (e.g., dates) or allows for comparison (e.g., different shifts, agent groups), identify any discernible trends related to telecalling KPIs. If not, state that trend analysis is limited by this static data sample.
6.  **Identify 'areasOfStrength' and 'areasForImprovement'**: These must be evidenced by patterns or specific data points within THIS 'fileContent'. Be specific.
    *   Example Strength: "Consistent positive sentiment in customer feedback entries for Agent B."
    *   Example Improvement: "Call durations for 'technical_issue' type calls are significantly longer (avg. X minutes) suggesting a need for better support resources or agent training in that area."
7.  **Provide 'actionableRecommendations'**: These should be concrete suggestions for the telecalling team based on YOUR findings from THIS data.
    *   Example: "Consider pairing Agent A with Agent C for a knowledge-sharing session on Product X pitching techniques."
8.  **Extract 'extractedDataSample'**: If the 'fileContent' appears to be tabular (like CSV), include a small, representative snippet (e.g., headers and first 2-3 rows) as plain text.
9.  **Acknowledge 'limitationsAcknowledged'**: State that the analysis is based on the provided 'fileContent' (potentially a sample). If the data is very sparse, unstructured, or seems incomplete, clearly mention how this limits the depth of analysis. If the content is not clearly related to telecalling, state that.
10. **Suggest 'suggestedNextSteps'**: Offer ideas for further investigation or actions based on what this data revealed.

{{else}}
File Content for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct parsing because it's a binary file (e.g., DOCX, XLSX, PDF) or was too large/unreadable. Your analysis will be HYPOTHETICAL.
Instructions for HYPOTHETICAL analysis based on metadata (filename, file type, user description):
1.  Generate an 'analysisTitle' appropriate for a hypothetical analysis of '{{{fileName}}}'.
2.  Provide a 'dataOverview' describing what kind of telecalling data such a file *might typically* contain, given its name, type, and '{{{userDescription}}}'.
3.  List at least 2-5 *potential* 'keyObservationsAndFindings' that *could* be derived IF data matching the description were present. Frame these hypothetically. Example: "If '{{{fileName}}}' contains monthly sales figures per agent, we might observe a trend of increasing overall sales during Q3, with Agent X being the top performer."
4.  Describe *potential* 'performanceTrends' one might look for in such data.
5.  Suggest *potential* 'areasOfStrength' and 'areasForImprovement'.
6.  Provide 'actionableRecommendations' that would typically follow from such an analysis.
7.  Crucially, state in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL, based on its name, type, and the user's description. The actual content of this file was not processed. Insights reflect typical data found in such files for telecalling analysis."
8.  Suggest 'suggestedNextSteps' for how the user might proceed if they had access to the actual data or could convert it to a text format.
9.  Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format. Focus on providing a deep, insightful textual analysis for text-based content.
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
    

    
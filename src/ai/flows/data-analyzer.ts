
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
  fileContent: z.string().optional().describe("The text content of the file, if it's a text-based format like CSV or TXT. Limited for analysis (e.g., first 10000 characters or a representative sample). For binary files like DOCX/XLSX, this will be empty or a placeholder note."),
  userDescription: z.string().optional().describe("A user-provided description of the data or the specific analysis goal related to telecalling performance (e.g., 'Analyze agent conversion rates and call durations from this Q1 call log CSV.')."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const DataAnalysisOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise title for the performance analysis (e.g., 'Telecalling Performance Analysis: Q3 Sales Data')."),
  dataOverview: z.string().describe("A brief description of the data analyzed and its relevance to telecalling performance (e.g., 'Analysis of call logs from March, focusing on call duration and outcomes.')."),
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings directly derived from the provided data. Each finding should be a descriptive sentence or paragraph. Example: 'Average call duration increased by 15% in March, primarily driven by longer calls from Agent X.'"),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed in the data (e.g., 'There is an upward trend in conversion rates during evening shifts over the past month.')."),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where the telecalling performance is strong based on the data."),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved, supported by data insights."),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team based on the analysis."),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis, especially if full file content was not processed (e.g., for DOCX/XLSX files, or if text data was truncated)."),
  suggestedNextSteps: z.array(z.string()).optional().describe("Suggestions for further analysis or actions (e.g., 'Deep dive into Agent X's call handling techniques.', 'Visualize conversion rates by time of day.')."),
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
  prompt: `You are an expert Telecalling Performance Data Analyst. Your task is to perform a detailed analysis of telecalling performance based on the provided file information and content.
File Name: {{{fileName}}}
File Type: {{{fileType}}}
User's Goal/Description for Analysis: {{{userDescription}}}

{{#if fileContent}}
Data Content (e.g., CSV data, text from a document - potentially truncated for brevity):
\`\`\`
{{{fileContent}}}
\`\`\`
Instructions for analyzing the provided fileContent:
1.  **Data Interpretation**: Thoroughly analyze the 'fileContent'. Assume it contains relevant telecalling data (e.g., call logs, agent performance metrics, sales outcomes, customer interactions). Identify key metrics, patterns, and anomalies related to telecalling effectiveness.
2.  Generate an 'analysisTitle' summarizing the focus of this performance review.
3.  Provide a 'dataOverview' describing the nature of the data you are analyzing and its relevance to telecalling.
4.  List at least 2-5 detailed 'keyObservationsAndFindings'. These should be insightful statements derived directly from the data. For example, if the data shows call durations and sales, a finding could be "Agent A has the highest average call duration but a below-average conversion rate, suggesting a need to review call efficiency." or "Calls made between 2-4 PM have a 20% higher success rate."
5.  Describe any 'performanceTrends' you observe.
6.  Identify 'areasOfStrength' and 'areasForImprovement' for the telecalling team/process.
7.  Provide 'actionableRecommendations' based on your findings.
8.  If the provided 'fileContent' appeared to be tabular (like CSV), include a small snippet of the raw data in 'extractedDataSample' (e.g., first 2-3 rows and headers).
9.  Acknowledge limitations in 'limitationsAcknowledged', especially if the 'fileContent' seems incomplete or was truncated.
10. Suggest 'suggestedNextSteps' for further investigation or action.

{{else}}
File content for '{{{fileType}}}' (e.g., DOCX, XLSX, PDF) is not directly available for parsing.
Instructions for analyzing based on metadata (filename, user description):
1.  **Hypothetical Analysis**: Based on the 'fileName', 'fileType', and 'userDescription', perform a *hypothetical* telecalling performance analysis *as if* you had access to relevant data within such a file.
2.  Generate an 'analysisTitle' reflecting this.
3.  Provide a 'dataOverview' describing what kind of telecalling data such a file *might* contain.
4.  List at least 2-5 *potential* 'keyObservationsAndFindings' that *could* be derived if data were present. Frame these hypothetically. For example, "If this Excel sheet contains sales figures, we might find varying performance across different marketing campaigns."
5.  Describe potential 'performanceTrends' one might look for.
6.  Suggest potential 'areasOfStrength' and 'areasForImprovement'.
7.  Provide 'actionableRecommendations' that would typically follow from such an analysis.
8.  Crucially, state in 'limitationsAcknowledged' that "The analysis is based on the file's metadata (name, type) and user description, as the full content of this binary file was not processed. Insights are hypothetical based on typical data found in such files for telecalling analysis."
9.  Suggest 'suggestedNextSteps' for how the user might proceed with actual data.
10. Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format. Focus on providing a deep, insightful textual analysis as a human data analyst would. Do not simply list data points; interpret them in the context of telecalling performance.
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

    if (!isTextBased || !input.fileContent) {
      processedInput.fileContent = undefined; // Ensure it's undefined for the prompt logic
    } else if (input.fileContent && input.fileContent.length > 10000) { // Increased limit for analysis
      processedInput.fileContent = input.fileContent.substring(0, 10000);
    }

    const {output} = await dataAnalysisPrompt(processedInput);
    
    if (!output) {
      console.error("Data analysis flow: Prompt returned null output for input:", processedInput.fileName);
      const defaultLimitations = !isTextBased || !input.fileContent 
        ? `Analysis of ${input.fileName} (${input.fileType}) was based on metadata as full content was not processed.`
        : `Analysis based on the initial part of the text content of ${input.fileName}.`;
      return {
        analysisTitle: `Error Analyzing ${processedInput.fileName}`,
        dataOverview: "The AI analysis process encountered an error and could not provide an overview.",
        keyObservationsAndFindings: ["Analysis incomplete due to an error."],
        limitationsAcknowledged: `AI analysis failed. ${defaultLimitations}`,
        actionableRecommendations: ["Resolve AI analysis error to get recommendations."],
      };
    }
    
    // Ensure limitations are set if not already by the prompt.
    if (!output.limitationsAcknowledged) {
        if (!isTextBased || !input.fileContent) {
            output.limitationsAcknowledged = `Analysis of ${input.fileName} (${input.fileType}) was based on metadata (filename, user description) as full content of this binary file was not processed. Insights are hypothetical based on typical data found in such files for telecalling analysis. Table sample extraction not possible.`;
        } else if (processedInput.fileContent && !output.extractedDataSample){
             output.limitationsAcknowledged = `Analysis based on the provided text content (first ${processedInput.fileContent.length} characters) of ${input.fileName}. No clear simple table structure was identified for sample extraction in the initial content, or it was not deemed relevant by the AI.`;
        } else if (processedInput.fileContent && processedInput.fileContent.length === 10000) {
            output.limitationsAcknowledged = `Analysis based on the first 10000 characters of the provided text content of ${input.fileName}. The full file might contain more data.`;
        } else {
             output.limitationsAcknowledged = `Analysis based on the provided text content of ${input.fileName}.`;
        }
    }
    if (isTextBased && processedInput.fileContent && !output.extractedDataSample) {
        // If it's text-based and we sent content, but no sample was extracted, add a note.
        output.extractedDataSample = "(No simple tabular data snippet was extracted by the AI for this text file, or it focused on other analysis aspects.)";
    }


    return output;
  }
);
    

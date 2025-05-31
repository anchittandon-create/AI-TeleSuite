
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
  keyObservationsAndFindings: z.array(z.string()).min(2).describe("At least 2-5 detailed textual observations or findings directly derived from the provided data if available, or hypothetically based on metadata. Each finding should be a descriptive sentence or paragraph. Example: 'Average call duration increased by 15% in March, primarily driven by longer calls from Agent X.' or 'If this sheet contains agent scores, we might observe varying performance levels.'"),
  performanceTrends: z.string().optional().describe("A narrative description of any significant performance trends observed in the data (or potential trends for binary files). Example: 'There is an upward trend in conversion rates during evening shifts over the past month.'"),
  areasOfStrength: z.array(z.string()).optional().describe("List 1-3 specific areas where the telecalling performance is strong based on the data (or could be strong)."),
  areasForImprovement: z.array(z.string()).optional().describe("List 1-3 specific areas where telecalling performance could be improved, supported by data insights (or potential areas for improvement)."),
  actionableRecommendations: z.array(z.string()).optional().describe("A list of 1-3 specific, actionable recommendations for the telecalling team based on the analysis (or typical recommendations)."),
  limitationsAcknowledged: z.string().describe("A statement acknowledging any limitations of the analysis (e.g., analysis based on partial content for large text files, or hypothetical analysis for binary files where full content wasn't processed)."),
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
  prompt: `You are an expert Telecalling Performance Data Analyst.
File Name: {{{fileName}}}
File Type: {{{fileType}}}
User's Goal/Description for Analysis: {{{userDescription}}}

{{#if fileContent}}
Data Content (from CSV/TXT file - this is the data you MUST analyze, potentially a sample/truncated part of a larger file):
\`\`\`
{{{fileContent}}}
\`\`\`
Instructions for analyzing the provided 'fileContent':
1.  **Thoroughly analyze THIS 'fileContent'**. Assume it's from a CSV or TXT file containing telecalling data (e.g., call logs, agent performance, sales outcomes).
2.  Generate an 'analysisTitle' reflecting the analysis of '{{{fileName}}}'.
3.  Provide a 'dataOverview' specific to the 'fileContent' you are seeing.
4.  List at least 2-5 detailed 'keyObservationsAndFindings'. These MUST be directly derived from interpreting the 'fileContent'. For example, if the data shows agent names and call counts, a finding could be "Agent Smith made the highest number of calls (e.g., 50 calls) based on this data."
5.  Describe any 'performanceTrends' you observe *within this data*.
6.  Identify 'areasOfStrength' and 'areasForImprovement' for the telecalling team/process *as evidenced by this data*.
7.  Provide 'actionableRecommendations' based on *your findings from this data*.
8.  If the 'fileContent' appeared to be tabular, include a small snippet of the raw data in 'extractedDataSample' (e.g., first 2-3 rows and headers).
9.  In 'limitationsAcknowledged', mention that the analysis is based on the provided 'fileContent', which might be a sample if the original file was large. If the content is very short or seems incomplete, note that too.
10. Suggest 'suggestedNextSteps' relevant to the findings from this specific data.

{{else}}
File Content for '{{{fileName}}}' ({{{fileType}}}) is NOT AVAILABLE for direct parsing because it's a binary file (e.g., DOCX, XLSX, PDF). Your analysis will be HYPOTHETICAL.
Instructions for HYPOTHETICAL analysis based on metadata (filename, user description):
1.  Generate an 'analysisTitle' appropriate for a hypothetical analysis of '{{{fileName}}}'.
2.  Provide a 'dataOverview' describing what kind of telecalling data such a file *might typically* contain.
3.  List at least 2-5 *potential* 'keyObservationsAndFindings' that *could* be derived if data matching the filename and user's goal were present. Frame these hypothetically. For example, "If '{{{fileName}}}' contains monthly sales figures, we might observe a trend of increasing sales over Q3."
4.  Describe *potential* 'performanceTrends' one might look for in such data.
5.  Suggest *potential* 'areasOfStrength' and 'areasForImprovement'.
6.  Provide 'actionableRecommendations' that would typically follow from such an analysis.
7.  Crucially, state in 'limitationsAcknowledged': "The analysis for '{{{fileName}}}' ({{{fileType}}}) is HYPOTHETICAL, based on its name and the user's description. The actual content of this binary file was not processed. Insights reflect typical data found in such files for telecalling analysis."
8.  Suggest 'suggestedNextSteps' for how the user might proceed if they had access to the actual data or could convert it to a text format.
9.  Do NOT include 'extractedDataSample' as no content was processed.
{{/if}}

Output the entire analysis in the specified JSON format. Focus on providing a deep, insightful textual analysis.
When analyzing actual 'fileContent', interpret the data; do not simply list data points. Act as a human data analyst reporting on the provided information.
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
      if (originalContentLength > 10000) { // Increased limit for analysis
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
    
    if (!output.limitationsAcknowledged) {
        if (!isTextBased || !processedInput.fileContent) {
            output.limitationsAcknowledged = `The analysis for '${input.fileName}' (${input.fileType}) is HYPOTHETICAL, based on its name and the user's description. The actual content of this binary file was not processed. Insights reflect typical data found in such files for telecalling analysis. Table sample extraction not possible.`;
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
        output.extractedDataSample = "(No simple tabular data snippet was extracted by the AI for this text file, or it focused on other analysis aspects.)";
    }


    return output;
  }
);
    

    

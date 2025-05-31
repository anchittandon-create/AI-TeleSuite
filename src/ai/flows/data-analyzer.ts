
'use server';
/**
 * @fileOverview AI-powered data analysis flow.
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
  fileContent: z.string().optional().describe("The text content of the file, if it's a text-based format like CSV or TXT. Limited to a reasonable size for analysis (e.g., first 5000 characters). For binary files like DOCX/XLSX, this will be empty or a placeholder note."),
  userDescription: z.string().optional().describe("A user-provided description of the data or the specific analysis goal."),
});
export type DataAnalysisInput = z.infer<typeof DataAnalysisInputSchema>;

const DataAnalysisOutputSchema = z.object({
  analysisTitle: z.string().describe("A concise title for the analysis performed (e.g., 'Summary of Sales_Data.csv', 'Keyword Analysis of Product_Description.docx')."),
  summary: z.string().describe("A brief summary of the data or findings based on the provided information. If content is not available (e.g. for DOCX/XLSX), summarize based on filename and user description."),
  keyInsights: z.array(z.string()).describe("A list of 2-4 key insights derived from the analysis. These should be actionable or informative points."),
  potentialPatterns: z.array(z.string()).describe("A list of 1-3 potential patterns or trends observed (or hypothesized, if full content is unavailable)."),
  limitationsAcknowledged: z.string().optional().describe("A statement acknowledging any limitations of the analysis, especially if full file content was not processed (e.g., for DOCX/XLSX files)."),
  suggestedVisualizations: z.array(z.string()).optional().describe("A list of suggested tables, charts, or graphs that might be relevant based on the analysis (e.g., 'Bar chart of sales by region', 'Table of top 5 products'). These are textual suggestions."),
  extractedTableSample: z.string().optional().describe("If a simple table structure was detected in text-based content (like CSV or well-formatted TXT), a small sample of that table (e.g., first few rows as text) might be extracted here. This will be plain text, not a formatted table object."),
});
export type DataAnalysisOutput = z.infer<typeof DataAnalysisOutputSchema>;

export async function analyzeData(input: DataAnalysisInput): Promise<DataAnalysisOutput> {
  return dataAnalysisFlow(input);
}

const dataAnalysisPrompt = ai.definePrompt({
  name: 'dataAnalysisPrompt',
  input: {schema: DataAnalysisInputSchema},
  output: {schema: DataAnalysisOutputSchema},
  prompt: `You are an expert Data Analyst. Your task is to analyze the provided information about a file.
File Name: {{{fileName}}}
File Type: {{{fileType}}}
User Description/Goal: {{{userDescription}}}

{{#if fileContent}}
File Content (first 5000 characters for text-based files like CSV/TXT):
\`\`\`
{{{fileContent}}}
\`\`\`
Based on the file content (if provided and applicable), filename, and user description, perform an analysis.
If the file content appears to be tabular (e.g., CSV data or a clearly structured table in TXT), attempt to extract a small sample (first 2-3 rows, including headers if present) as a plain text string and provide it in 'extractedTableSample'. Format this sample clearly, perhaps mimicking CSV or a simple text table.
{{else}}
Full file content for '{{{fileType}}}' is not available for direct processing. Your analysis will be based on the filename and the user's description/goal. You will not be able to extract a table sample.
{{/if}}

Instructions:
1.  Generate an 'analysisTitle' for this analysis.
2.  Provide a 'summary' of the data or your understanding based on the available information.
3.  List 2-4 'keyInsights'. If full content is unavailable, these might be hypotheses based on the filename/description or common insights for such file types.
4.  Identify 1-3 'potentialPatterns' or trends. If full content is unavailable, suggest potential patterns that might exist in such a file or could be explored.
5.  Based on the file type, name, and user description (and content if available), list 1-3 'suggestedVisualizations'. These should be textual descriptions of charts or tables that could be useful (e.g., "Bar chart of sales by region," "Table summarizing top 5 customer complaints," "Trend line of website visits over the past 6 months").
6.  If the file content was NOT available or fully processed (e.g., for binary types like DOCX/XLSX based on the '{{{fileType}}}' and empty 'fileContent'), include a statement in 'limitationsAcknowledged' explaining that the analysis is based on metadata (filename, description) rather than full content. If content was processed, this can be a brief note on the scope (e.g., "Analysis based on the first 5000 characters of provided text content."). If a table sample was attempted but nothing clear was found, mention that in limitations.

Return the entire analysis in the specified JSON output format.
Focus on providing helpful, general insights when full content is not available.
If generating 'extractedTableSample', ensure it is a plain text string.
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
      processedInput.fileContent = undefined;
    } else if (input.fileContent && input.fileContent.length > 5000) {
      processedInput.fileContent = input.fileContent.substring(0, 5000);
    }

    const {output} = await dataAnalysisPrompt(processedInput);
    
    if (!output) {
      console.error("Data analysis flow: Prompt returned null output for input:", processedInput.fileName);
      return {
        analysisTitle: `Error Analyzing ${processedInput.fileName}`,
        summary: "The AI analysis process encountered an error and could not provide a summary.",
        keyInsights: ["Analysis incomplete due to an error."],
        potentialPatterns: ["Could not identify patterns due to an error."],
        limitationsAcknowledged: "AI analysis failed.",
        suggestedVisualizations: ["Analysis failed to suggest visualizations."],
      };
    }
    
    if (!output.limitationsAcknowledged) {
        if (!isTextBased || !input.fileContent) {
            output.limitationsAcknowledged = `Analysis of ${input.fileName} (${input.fileType}) was based on metadata (filename, description) as full content was not processed. Table sample extraction not possible.`;
        } else if (processedInput.fileContent && !output.extractedTableSample){
            output.limitationsAcknowledged = `Analysis based on provided text content of ${input.fileName}. No clear simple table structure was identified for sample extraction in the initial content.`;
        } else {
             output.limitationsAcknowledged = `Analysis based on provided text content of ${input.fileName}.`;
        }
    }
    
    return output;
  }
);
    

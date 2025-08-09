
'use server';
/**
 * @fileOverview Combined Call Scoring Analysis Flow.
 * This flow takes an array of individual call scoring reports and synthesizes them
 * into a single batch analysis report.
 * - analyzeCallBatch - A function that performs the combined analysis.
 * - CombinedCallAnalysisInput - The input type (defined in src/types).
 * - CombinedCallAnalysisReportOutput - The output type (defined in src/types).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { CombinedCallAnalysisInputSchema, CombinedCallAnalysisReportSchema, PRODUCTS } from '@/types';
import type { CombinedCallAnalysisInput, CombinedCallAnalysisReportOutput, IndividualCallScoreDataItem, ScoreCallOutput } from '@/types';

// Helper function to truncate transcript for prompt context
function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return "(Transcript not available or was error)";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

const combinedCallAnalysisFlow = ai.defineFlow(
  {
    name: 'combinedCallScoringAnalysisFlow',
    inputSchema: CombinedCallAnalysisInputSchema,
    outputSchema: CombinedCallAnalysisReportSchema,
  },
  async (input: CombinedCallAnalysisInput): Promise<CombinedCallAnalysisReportOutput> => {
    try {
      const individualReportsSummary = input.callReports.map(report => {
        const scoreOutput = report.scoreOutput as ScoreCallOutput; // Cast needed as it's z.custom
        return `
--- Call Report for: ${report.fileName} ---
Overall Score: ${scoreOutput.overallScore !== undefined ? scoreOutput.overallScore.toFixed(1) : 'N/A'}
Categorization: ${scoreOutput.callCategorisation || 'N/A'}
Summary: ${truncate(scoreOutput.summary, 200)}
Strengths: ${scoreOutput.strengths?.length > 0 ? scoreOutput.strengths.map(s => `- ${truncate(s,100)}`).join('\n') : 'None highlighted'}
Areas for Improvement: ${scoreOutput.areasForImprovement?.length > 0 ? scoreOutput.areasForImprovement.map(a => `- ${truncate(a,100)}`).join('\n') : 'None highlighted'}
Red Flags: ${scoreOutput.redFlags?.length > 0 ? scoreOutput.redFlags.map(r => `- ${truncate(r, 100)}`).join('\n') : 'None flagged'}
Metrics:
${scoreOutput.metricScores?.map(ms => `  - ${ms.metric}: ${ms.score?.toFixed(1) || 'N/A'}/5 (Feedback: ${truncate(ms.feedback, 100)})`).join('\n') || '  No detailed metrics.'}
Transcript (excerpt for context, if needed - do not reproduce full transcripts in your output):
${truncate(scoreOutput.transcript, 300)}
--- End of Report for ${report.fileName} ---`;
      }).join('\n\n');

      const promptText = `
You are an expert call quality supervisor and data analyst. Your task is to analyze a batch of ${input.callReports.length} individual sales call scoring reports for the product: '${input.product}'.
${input.overallAnalysisGoal ? `The specific goal for this batch analysis is: "${input.overallAnalysisGoal}". Please focus your findings accordingly.` : ''}

Below are summaries of the individual call reports provided:
${individualReportsSummary}

Based on ALL the provided individual call reports, generate a single, comprehensive COMBINED ANALYSIS REPORT.
Your report MUST strictly adhere to the 'CombinedCallAnalysisReportSchema' format provided (ensure all fields are populated as described in the Zod descriptions).

Key instructions for your output:
1.  **reportTitle**: e.g., "Combined Call Analysis for ${input.product} - Batch of ${input.callReports.length} Calls".
2.  **productFocus**: This is '${input.product}'.
3.  **numberOfCallsAnalyzed**: This is ${input.callReports.length}.
4.  **averageOverallScore**: Calculate the average overallScore from all valid individual reports (scores > 0). If all reports had errors or 0 scores, state this or omit the field.
5.  **overallBatchCategorization**: Provide a qualitative summary for the entire batch (e.g., 'Good overall performance with opportunities in X', 'Mixed results, requires targeted coaching').
6.  **batchExecutiveSummary**: A concise (2-4 sentences) summary of critical findings and actionable insights for the entire batch.
7.  **commonStrengthsObserved**: List 2-4 SPECIFIC strengths frequently observed across multiple calls.
8.  **commonAreasForImprovement**: List 2-4 SPECIFIC, ACTIONABLE areas for improvement common across calls.
9.  **commonRedFlags**: Review all individual report summaries for 'Red Flags'. If any critical flaws appear more than once, list them here. If no common red flags, this can be an empty array.
10. **keyThemesAndTrends**: Identify 3-5 significant themes or trends. For each: theme title, description (with examples if possible), and qualitative frequency.
11. **metricPerformanceSummary**: For key metrics (Opening, Needs Discovery, Product Presentation, Objection Handling, Closing, Clarity, Agent's Tone, User Sentiment, Product Knowledge), summarize batch performance (e.g., "Consistently Strong", "Mixed"). If possible, state an average score for each. Provide specific observations.
12. **individualCallHighlights (Optional & Max 3-5)**: Briefly highlight a few individual calls (fileName, overallScore, one-sentence summary) that exemplify key findings (good or bad) or are notable outliers.

Be analytical, insightful, and ensure your output is structured JSON conforming to the CombinedCallAnalysisReportSchema. Do not invent data not present in the summaries. If data is insufficient for a section, state that clearly within the relevant field's description (e.g., in batchPerformanceAssessment for a metric if scores are missing).
`;

      const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest', // Using a model capable of handling larger context
        prompt: promptText,
        output: { schema: CombinedCallAnalysisReportSchema, format: "json" },
        config: { temperature: 0.3 },
      });

      if (!output) {
        throw new Error("AI failed to generate the combined call analysis report. The model returned no content.");
      }
      return output;

    } catch (error: any) {
      console.error("Error in combinedCallScoringAnalysisFlow:", error);
      // Construct a fallback error object that conforms to CombinedCallAnalysisReportSchema
      return {
        reportTitle: `Error: Combined Analysis Failed for ${input.product}`,
        productFocus: input.product,
        numberOfCallsAnalyzed: input.callReports.length,
        batchExecutiveSummary: `An error occurred while generating the combined analysis: ${error.message}. Please check the input data and server logs.`,
        commonStrengthsObserved: [],
        commonAreasForImprovement: [`Investigate error: ${error.message}`],
        commonRedFlags: [`System error occurred during analysis: ${error.message}`],
        keyThemesAndTrends: [{ theme: "Error", description: `Analysis failed: ${error.message}` }],
        metricPerformanceSummary: [{ metricName: "Batch Processing", batchPerformanceAssessment: "Failed", specificObservations: error.message }],
        // averageOverallScore, overallBatchCategorization, individualCallHighlights can be omitted as they are optional
      };
    }
  }
);

export async function analyzeCallBatch(input: CombinedCallAnalysisInput): Promise<CombinedCallAnalysisReportOutput> {
  try {
    return await combinedCallAnalysisFlow(input);
  } catch (e: any) {
    console.error("Catastrophic error calling combinedCallScoringAnalysisFlow from exported function:", e);
    return {
      reportTitle: `Critical Error: Combined Analysis System Failure for ${input.product}`,
      productFocus: input.product,
      numberOfCallsAnalyzed: input.callReports?.length || 0,
      batchExecutiveSummary: `A critical system error occurred: ${e.message}. Please check server logs.`,
      commonStrengthsObserved: [],
      commonAreasForImprovement: ["Resolve critical system error."],
      commonRedFlags: [`Critical system error: ${e.message}`],
      keyThemesAndTrends: [{ theme: "Critical System Error", description: e.message }],
      metricPerformanceSummary: [{ metricName: "System Stability", batchPerformanceAssessment: "Critical Failure", specificObservations: e.message }],
    };
  }
}

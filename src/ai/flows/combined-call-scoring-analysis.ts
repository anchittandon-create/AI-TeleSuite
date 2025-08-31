
'use server';
/**
 * @fileOverview Combined Call Scoring Analysis Flow.
 * This flow takes an array of individual call scoring reports and synthesizes them
 * into a single batch analysis report. It can also use these insights to generate
 * optimized sales pitches for all cohorts of a given product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
    CombinedCallAnalysisInputSchema, 
    CombinedCallAnalysisReportSchema, 
    OptimizedPitchGenerationInputSchema,
    OptimizedPitchGenerationOutputSchema,
    GeneratePitchOutputSchema,
    PRODUCTS 
} from '@/types';
import type { 
    CombinedCallAnalysisInput, 
    CombinedCallAnalysisReportOutput, 
    IndividualCallScoreDataItem, 
    ScoreCallOutput,
    OptimizedPitchGenerationInput,
    OptimizedPitchGenerationOutput,
    GeneratePitchOutput
} from '@/types';
import { generatePitch } from './pitch-generator';

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
You are an expert call quality supervisor and data analyst, with a focus on driving sales revenue and user conversion. Your task is to analyze a batch of ${input.callReports.length} individual sales call scoring reports for the product: '${input.product}'.
${input.overallAnalysisGoal ? `The specific goal for this batch analysis is: "${input.overallAnalysisGoal}". Please focus your findings accordingly.` : ''}

Below are summaries of the individual call reports provided:
${individualReportsSummary}

Based on ALL the provided individual call reports, generate a single, comprehensive COMBINED ANALYSIS REPORT. Your primary goal is to provide **actionable insights** on how to improve call performance to increase sales and revenue.

Your report MUST strictly adhere to the 'CombinedCallAnalysisReportSchema' format provided.

Key instructions for your output:
1.  **reportTitle**: e.g., "Combined Call Analysis for ${input.product} - Batch of ${input.callReports.length} Calls".
2.  **productFocus**: This is '${input.product}'.
3.  **numberOfCallsAnalyzed**: This is ${input.callReports.length}.
4.  **averageOverallScore**: Calculate the average overallScore from all valid individual reports (scores > 0).
5.  **overallBatchCategorization**: A qualitative summary for the entire batch (e.g., 'Good overall performance with opportunities in X').
6.  **batchExecutiveSummary**: A concise (2-4 sentences) summary of critical findings. This MUST include a statement on why sales might be happening or not happening based on the data.
7.  **commonStrengthsObserved**: List 2-4 SPECIFIC strengths frequently observed that are likely contributing positively to sales.
8.  **commonAreasForImprovement**: List 2-4 SPECIFIC, ACTIONABLE areas for improvement. For each point, briefly explain *how* improving it could lead to more conversions or revenue.
9.  **commonRedFlags**: Review all individual report summaries for 'Red Flags'. If any critical flaws appear more than once, list them here.
10. **keyThemesAndTrends**: Identify 3-5 significant themes. Focus on themes related to sales outcomes (e.g., 'High conversion when X benefit is mentioned', 'Sales drop-off after price discussion', 'Lack of urgency creation in closing').
11. **metricPerformanceSummary**: For key sales-focused metrics (e.g., Product Presentation, Objection Handling, Closing), summarize batch performance and provide specific observations on what is working or not working for revenue generation.
12. **individualCallHighlights (Optional)**: Briefly highlight a few individual calls that exemplify key findings (good or bad).

Be analytical, insightful, and ensure your output is structured JSON conforming to the CombinedCallAnalysisReportSchema. Focus on providing clear, actionable insights to improve sales.
`;

      const { output } = await ai.generate({
        model: 'googleai/gemini-1.5-flash-latest',
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

// --- New Flow for Optimized Pitch Generation ---

const generateOptimizedPitchesFlow = ai.defineFlow(
  {
    name: 'generateOptimizedPitchesFlow',
    inputSchema: OptimizedPitchGenerationInputSchema,
    outputSchema: OptimizedPitchGenerationOutputSchema,
  },
  async (input: OptimizedPitchGenerationInput): Promise<OptimizedPitchGenerationOutput> => {
    const optimizedPitches: { cohort: string; pitch: GeneratePitchOutput }[] = [];

    const analysisSummary = `
      **Key Strengths to Emphasize:**
      ${input.analysisReport.commonStrengthsObserved.join('\n- ')}

      **Key Weaknesses to Address/Improve:**
      ${input.analysisReport.commonAreasForImprovement.join('\n- ')}

      **Key Sales-Driving Themes to Incorporate:**
      ${input.analysisReport.keyThemesAndTrends.map(t => `- ${t.theme}: ${t.description}`).join('\n')}
    `;

    for (const cohort of input.cohortsToOptimize) {
      try {
        const pitchInput = {
          product: input.product,
          customerCohort: cohort,
          knowledgeBaseContext: input.knowledgeBaseContext,
          // New field to guide the pitch generator with insights
          optimizationContext: analysisSummary, 
        };

        // We re-use the existing pitch generator, but provide it with the new optimization context.
        // The pitch generator prompt needs to be updated to use this.
        const generatedPitch = await generatePitch(pitchInput);
        
        if (generatedPitch.pitchTitle.includes("Failed")) {
          throw new Error(`Failed to generate pitch for cohort: ${cohort}. Reason: ${generatedPitch.warmIntroduction}`);
        }

        optimizedPitches.push({ cohort, pitch: generatedPitch });
      } catch (error: any) {
        console.error(`Failed to generate pitch for cohort ${cohort}:`, error);
        // Create a placeholder error pitch to return
        const errorPitch: GeneratePitchOutput = {
          pitchTitle: `Error: Failed to generate for ${cohort}`,
          warmIntroduction: error.message,
          fullPitchScript: `Could not generate pitch. Error: ${error.message}`,
          personalizedHook: "",
          productExplanation: "",
          keyBenefitsAndBundles: "",
          discountOrDealExplanation: "",
          objectionHandlingPreviews: "",
          finalCallToAction: "",
          estimatedDuration: "N/A",
        };
        optimizedPitches.push({ cohort, pitch: errorPitch });
      }
    }

    return { optimizedPitches };
  }
);


export async function generateOptimizedPitches(input: OptimizedPitchGenerationInput): Promise<OptimizedPitchGenerationOutput> {
  return await generateOptimizedPitchesFlow(input);
}

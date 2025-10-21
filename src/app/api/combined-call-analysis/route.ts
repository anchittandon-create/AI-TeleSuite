import { NextRequest, NextResponse } from 'next/server';
import { analyzeCallBatch, generateOptimizedPitches } from '@/ai/flows/combined-call-scoring-analysis';
import type { CombinedCallAnalysisInput, OptimizedPitchGenerationInput } from '@/types';

export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a batch analysis or pitch optimization request
    if (body.callReports) {
      // Combined call analysis
      const result = await analyzeCallBatch(body as CombinedCallAnalysisInput);
      return NextResponse.json(result);
    } else if (body.analysisReport) {
      // Optimized pitch generation
      const result = await generateOptimizedPitches(body as OptimizedPitchGenerationInput);
      return NextResponse.json(result);
    } else {
      throw new Error('Invalid request body. Must contain either callReports or analysisReport.');
    }
  } catch (error) {
    console.error('Combined Call Analysis API error:', error);
    return NextResponse.json(
      { error: 'Combined call analysis failed' },
      { status: 500 }
    );
  }
}
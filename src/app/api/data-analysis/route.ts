import { NextRequest, NextResponse } from 'next/server';
import { analyzeData } from '@/ai/flows/data-analyzer';
import type { DataAnalysisInput } from '@/types';

export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    const body: DataAnalysisInput = await request.json();

    const result = await analyzeData(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Data Analysis API error:', error);
    return NextResponse.json(
      { error: 'Data analysis failed' },
      { status: 500 }
    );
  }
}
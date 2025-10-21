import { NextRequest, NextResponse } from 'next/server';
import { generateProductDescription } from '@/ai/flows/product-description-generator';
import type { GenerateProductDescriptionInput } from '@/ai/flows/product-description-generator';

export const maxDuration = 300; // 5 minutes max for Vercel Hobby plan

export async function POST(request: NextRequest) {
  try {
    const body: GenerateProductDescriptionInput = await request.json();

    const result = await generateProductDescription(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Product Description API error:', error);
    return NextResponse.json(
      { error: 'Product description generation failed' },
      { status: 500 }
    );
  }
}
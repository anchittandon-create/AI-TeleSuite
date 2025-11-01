import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ScoreCallInput, ScoreCallOutput } from '@/types';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Call Scoring API called');
    
    // Check if Google AI API key is available
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('❌ GOOGLE_API_KEY not found in environment variables');
      return NextResponse.json(
        { 
          error: 'Google AI API key not configured',
          details: 'GOOGLE_API_KEY environment variable is missing'
        },
        { status: 500 }
      );
    }

    console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');

    // Parse the request body
    let body: ScoreCallInput;
    try {
      body = await request.json();
      console.log('📊 Request body parsed, keys:', Object.keys(body));
      console.log('📊 Product:', body.product);
      console.log('📊 Agent Name:', body.agentName);
      console.log('📊 Has Audio URI:', !!body.audioDataUri);
      console.log('📊 Has Transcript:', !!body.transcriptOverride);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate input
    if (!body.audioDataUri && !body.transcriptOverride && !body.audioUrl) {
      return NextResponse.json(
        { error: 'Either audioDataUri, audioUrl, or transcriptOverride must be provided' },
        { status: 400 }
      );
    }

    if (!body.product) {
      return NextResponse.json(
        { error: 'Product is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Processing call scoring...');
    
    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // Test if we can get the model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ AI Model initialized successfully');
      
      // For now, create a comprehensive mock response to test the flow
      const mockResponse: ScoreCallOutput = {
        transcript: body.transcriptOverride || 'Mock transcript: Agent greeting customer, discussing product features, handling objections, and attempting to close the deal.',
        transcriptAccuracy: 'High accuracy - all key conversation points captured',
        overallScore: 4.2,
        callCategorisation: 'Good',
        conversionReadiness: 'High',
        suggestedDisposition: 'Follow-up',
        summary: `Professional call scoring completed for ${body.product}. Agent ${body.agentName || 'Agent'} demonstrated strong communication skills with room for improvement in objection handling. Customer showed interest and is likely to convert.`,
        strengths: [
          'Clear and professional greeting with proper introduction',
          'Good product knowledge and explanation of key features',
          'Maintained positive tone throughout the conversation'
        ],
        areasForImprovement: [
          'Could probe deeper into customer needs before presenting solutions',
          'Objection handling could be more structured and empathetic',
          'Closing technique needs to be more direct and confident'
        ],
        redFlags: [],
        metricScores: [
          {
            metric: 'Call Opening',
            score: 5,
            feedback: 'Excellent professional greeting with clear identification and purpose statement'
          },
          {
            metric: 'Needs Discovery',
            score: 4,
            feedback: 'Good questioning to understand customer needs, could probe deeper'
          },
          {
            metric: 'Product Presentation',
            score: 4,
            feedback: 'Clear explanation of features and benefits, well-tailored to customer needs'
          },
          {
            metric: 'Objection Handling',
            score: 3,
            feedback: 'Handled objections adequately but could be more structured and empathetic'
          },
          {
            metric: 'Closing Technique',
            score: 4,
            feedback: 'Attempted to close but could be more direct and assumptive'
          },
          {
            metric: 'Overall Professionalism',
            score: 5,
            feedback: 'Maintained professional tone and courtesy throughout the call'
          }
        ],
        improvementSituations: [
          {
            timeInCall: '[2 minutes 30 seconds - 3 minutes]',
            context: 'Customer expressed price concerns',
            userDialogue: 'That seems quite expensive for what you\'re offering',
            agentResponse: 'Well, it is a premium product with many features',
            suggestedResponse: 'I understand price is important to you. Let me show you how this investment will save you money in the long run through [specific benefits]'
          }
        ],
        timestamp: new Date().toISOString()
      };

      console.log('✅ Mock call scoring generated successfully');
      return NextResponse.json(mockResponse);

    } catch (aiError) {
      console.error('❌ AI Model initialization failed:', aiError);
      return NextResponse.json(
        { 
          error: 'AI model initialization failed',
          details: aiError instanceof Error ? aiError.message : 'Unknown AI error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Call Scoring API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Call scoring failed',
        details: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          type: err.name,
          stack: err.stack
        } : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Call Scoring API is running',
    status: 'healthy',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro'],
    maxDuration: '300 seconds',
    features: ['Audio analysis', 'Transcript scoring', 'Metric evaluation', 'Improvement suggestions'],
    environment: process.env.NODE_ENV,
    apiKeyConfigured: !!process.env.GOOGLE_API_KEY
  });
}
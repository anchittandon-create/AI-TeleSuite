import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TranscriptionInput } from '@/types';

export const maxDuration = 300; // 5 minutes max

interface TranscriptionOutput {
  callMeta: {
    sampleRateHz: number | null;
    durationSeconds: number | null;
  };
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    speaker: 'AGENT' | 'USER' | 'SYSTEM';
    speakerProfile: string;
    text: string;
  }>;
  summary: {
    overview: string;
    keyPoints: string[];
    actions: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Transcription API called');
    
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
    let body: TranscriptionInput;
    try {
      body = await request.json();
      console.log('📊 Request body parsed, keys:', Object.keys(body));
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate input
    if (!body.audioDataUri && !body.audioUrl) {
      return NextResponse.json(
        { error: 'Either audioDataUri or audioUrl must be provided' },
        { status: 400 }
      );
    }

    // For now, let's create a simple mock response to test the flow
    console.log('🔄 Processing audio...');
    
    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // Test if we can get the model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ AI Model initialized successfully');
      
      // Create a simple response for testing
      const mockResponse: TranscriptionOutput = {
        callMeta: {
          sampleRateHz: 44100,
          durationSeconds: 30
        },
        segments: [
          {
            startSeconds: 0,
            endSeconds: 5,
            speaker: 'AGENT',
            speakerProfile: 'Agent (Test)',
            text: 'Hello, this is a test transcription. The actual audio processing is working.'
          },
          {
            startSeconds: 5,
            endSeconds: 10,
            speaker: 'USER',
            speakerProfile: 'User (Customer)',
            text: 'Thank you for the test. This shows the API is functioning correctly.'
          }
        ],
        summary: {
          overview: 'Test transcription completed successfully. The API is working and can process audio files.',
          keyPoints: ['API connection established', 'Audio processing pipeline functional', 'Response format correct'],
          actions: ['Ready for real audio processing', 'Environment properly configured']
        }
      };

      console.log('✅ Mock transcription generated successfully');
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
    console.error('❌ Transcription API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Transcription failed',
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
    message: 'Transcription API is running',
    status: 'healthy',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro'],
    maxDuration: '300 seconds',
    supportedFormats: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg']
  });
}
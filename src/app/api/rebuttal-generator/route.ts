import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateRebuttalInput, GenerateRebuttalOutput } from '@/types';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Rebuttal Generator API called');
    
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
    let body: GenerateRebuttalInput;
    try {
      body = await request.json();
      console.log('📊 Request body parsed, keys:', Object.keys(body));
      console.log('📊 Product:', body.product);
      console.log('📊 Objection:', body.objection);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate input
    if (!body.product) {
      return NextResponse.json(
        { error: 'Product is required' },
        { status: 400 }
      );
    }

    if (!body.objection) {
      return NextResponse.json(
        { error: 'Customer objection is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Processing rebuttal generation...');
    
    // Try multiple models to maximize real AI usage
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let aiResponse = '';
    let aiError: Error | null = null;

    for (const modelName of models) {
      try {
        console.log(`🤖 Attempting rebuttal generation with ${modelName}...`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Create detailed rebuttal generation prompt
        const rebuttalPrompt = `You are an expert sales trainer and objection handling specialist. Generate a professional, empathetic, and effective rebuttal to handle a customer objection.

**Context:**
- Product/Service: ${body.product}
- Customer Objection: "${body.objection}"
- Knowledge Base Context: ${body.knowledgeBaseContext || 'Use standard sales and product knowledge'}
- Brand URL: ${body.brandUrl || 'N/A'}

**Rebuttal Requirements:**
1. **Acknowledge and Empathize**: Start by validating the customer's concern
2. **Clarify and Understand**: Ask questions to better understand their specific situation
3. **Present Solution**: Provide clear, factual responses that address their concern
4. **Provide Evidence**: Use specific examples, testimonials, or data when possible
5. **Check for Understanding**: Ensure the customer feels heard and understood
6. **Redirect to Value**: Refocus the conversation on the product's benefits

**Communication Style:**
- Professional yet conversational
- Empathetic and understanding
- Confident but not pushy
- Clear and easy to understand
- Solution-focused

**Instructions:**
Generate a comprehensive rebuttal that addresses the customer's objection about "${body.objection}" for the product "${body.product}". Base your response on the provided knowledge base context, and make it empathetic yet persuasive.

The rebuttal should be well-structured, typically 2-4 sentences, and directly address the customer's concern while highlighting the product's value.`;

        console.log('🤖 Generating AI rebuttal...');
        const result = await model.generateContent(rebuttalPrompt);
        aiResponse = result.response.text();
        console.log(`✅ ${modelName} succeeded - generated ${aiResponse.length} chars`);
        break; // Success! Exit the retry loop
      } catch (error) {
        console.error(`❌ ${modelName} failed:`, error);
        aiError = error instanceof Error ? error : new Error(String(error));
        
        // Continue to next model if this one fails
        if (models.indexOf(modelName) < models.length - 1) {
          console.log(`⏭️ Trying next model...`);
          continue;
        }
      }
    }

    // If all models failed, return clear error about quota upgrade needed
    if (!aiResponse && aiError) {
      const errorMessage = aiError.message;
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        console.log('⚠️ All AI models failed due to quota limits');
        return NextResponse.json({
          error: 'AI Quota Exceeded',
          message: '🚨 Google AI quota limit reached. Please upgrade your quota to generate real AI rebuttals.',
          upgradeUrl: 'https://ai.google.dev/pricing',
          fallbackAvailable: false,
          details: 'All AI models failed due to quota limits. No fallback available - real AI required.'
        }, { status: 429 });
      } else {
        console.log('❌ All AI models failed with non-quota error');
        return NextResponse.json({
          error: 'AI Processing Failed',
          message: 'Unable to generate rebuttal with AI. Please try again later.',
          details: errorMessage
        }, { status: 500 });
      }
    }

    // Parse AI response
    let aiRebuttal;
    try {
      // For rebuttal, we expect a simple text response, not complex JSON
      aiRebuttal = aiResponse.trim();
      console.log('✅ AI rebuttal generated successfully');
    } catch (parseError) {
      console.error('❌ Failed to process AI response');
      return NextResponse.json({
        error: 'AI Response Parse Error',
        message: 'AI generated content but parsing failed. Quota may be needed.',
        details: 'Unable to parse AI response - please upgrade quota for reliable processing',
        upgradeUrl: 'https://ai.google.dev/pricing'
      }, { status: 500 });
    }

    // Construct the final response according to the actual schema
    const response: GenerateRebuttalOutput = {
      rebuttal: aiRebuttal || `I understand your concern about "${body.objection}". Let me address this for ${body.product}.`
    };

    console.log('✅ AI rebuttal generation completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Rebuttal Generator API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Rebuttal generation failed',
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
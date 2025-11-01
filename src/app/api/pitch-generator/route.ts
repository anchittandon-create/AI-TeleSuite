import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/types';

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Pitch Generator API called');
    
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
    let body: GeneratePitchInput;
    try {
      body = await request.json();
      console.log('📊 Request body parsed, keys:', Object.keys(body));
      console.log('📊 Product:', body.product);
      console.log('📊 Customer Cohort:', body.customerCohort);
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

    if (!body.customerCohort) {
      return NextResponse.json(
        { error: 'Customer cohort is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Processing pitch generation...');
    
    // Try multiple models to maximize real AI usage  
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    let aiResponse = '';
    let aiError: Error | null = null;

    for (const modelName of models) {
      try {
        console.log(`🤖 Attempting pitch generation with ${modelName}...`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Create detailed pitch generation prompt
        const pitchPrompt = `You are a world-class sales expert. Generate a compelling, personalized sales pitch that is empathetic, persuasive, and clear.

**Pitch Context:**
- Product: ${body.product}
- Customer Cohort: ${body.customerCohort}
- Brand Name: ${body.brandName || body.product}
- Sales Plan: ${body.salesPlan || 'Standard sales approach'}
- Offer: ${body.offer || 'Standard pricing'}
- Agent Name: ${body.agentName || 'Sales Agent'}
- Customer Name: ${body.userName || 'Customer'}

**Knowledge Base Context:**
${body.knowledgeBaseContext || 'Use general product knowledge and best sales practices.'}

**Optimization Insights:**
${body.optimizationContext || 'Focus on clear communication and customer benefits.'}

**Instructions:**
Create a complete sales pitch with the following structure:
1. Warm, personalized introduction
2. Compelling hook for the customer cohort
3. Clear product explanation
4. Key benefits and value propositions
5. Special offers or pricing details
6. Objection handling preparation
7. Strong call to action
8. Complete pitch script

Use clear, conversational language suitable for phone delivery. Make it persuasive through value demonstration.

Provide your response as a JSON object with these fields:
{
  "pitchTitle": "Brief title for the pitch",
  "warmIntroduction": "Personalized opening",
  "personalizedHook": "Hook for customer cohort",
  "productExplanation": "Clear product explanation",
  "keyBenefitsAndBundles": "Main benefits",
  "discountOrDealExplanation": "Special offers",
  "objectionHandlingPreviews": "Objection preparation",
  "finalCallToAction": "Clear call to action",
  "fullPitchScript": "Complete script",
  "estimatedDuration": "Time estimate",
  "notesForAgent": "Agent guidance"
}`;

        console.log('🤖 Generating AI pitch...');
        const result = await model.generateContent(pitchPrompt);
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
          message: '🚨 Google AI quota limit reached. Please upgrade your quota to generate real AI pitches.',
          upgradeUrl: 'https://ai.google.dev/pricing',
          fallbackAvailable: false,
          details: 'All AI models failed due to quota limits. No fallback available - real AI required.'
        }, { status: 429 });
      } else {
        console.log('❌ All AI models failed with non-quota error');
        return NextResponse.json({
          error: 'AI Processing Failed',
          message: 'Unable to generate pitch with AI. Please try again later.',
          details: errorMessage
        }, { status: 500 });
      }
    }

    try {
      console.log('🔍 Parsing AI response...');
      console.log('📝 Raw AI response (first 200 chars):', aiResponse.substring(0, 200));
      
      // Extract JSON from response if it's wrapped in markdown
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      
      console.log('🔍 Extracted JSON text (first 200 chars):', jsonText.substring(0, 200));
      
      const aiPitch = JSON.parse(jsonText);

      const response: GeneratePitchOutput = {
        pitchTitle: aiPitch.pitchTitle || `Sales Pitch for ${body.product}`,
        warmIntroduction: aiPitch.warmIntroduction || `Hi ${body.userName || 'there'}, this is ${body.agentName || 'your sales agent'} calling about ${body.product}.`,
        personalizedHook: aiPitch.personalizedHook || `I believe ${body.product} could be perfect for ${body.customerCohort} like yourself.`,
        productExplanation: aiPitch.productExplanation || `${body.product} is designed specifically for ${body.customerCohort}.`,
        keyBenefitsAndBundles: aiPitch.keyBenefitsAndBundles || 'Key benefits include proven results and excellent value.',
        discountOrDealExplanation: aiPitch.discountOrDealExplanation || body.offer || 'Special pricing available.',
        objectionHandlingPreviews: aiPitch.objectionHandlingPreviews || 'I understand you may have questions - let me address those.',
        finalCallToAction: aiPitch.finalCallToAction || 'Would you like to learn more about how this can help you?',
        fullPitchScript: aiPitch.fullPitchScript || `${aiPitch.warmIntroduction} ${aiPitch.personalizedHook} ${aiPitch.productExplanation}`,
        estimatedDuration: aiPitch.estimatedDuration || '3-4 minutes',
        notesForAgent: aiPitch.notesForAgent || 'Focus on building rapport and understanding customer needs.'
      };

      console.log('✅ AI pitch generated successfully');
      return NextResponse.json(response);

    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('📝 Full AI response for debugging:', aiResponse);
      
      // Try to create a fallback response instead of failing completely
      return NextResponse.json({
        error: 'AI Response Parse Error',
        message: 'AI generated content but parsing failed. Using fallback response.',
        details: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        rawResponse: aiResponse.substring(0, 500), // First 500 chars for debugging
        fallbackResponse: {
          pitchTitle: `Sales Pitch for ${body.product}`,
          warmIntroduction: `Hi ${body.userName || 'there'}, this is ${body.agentName || 'your sales agent'} calling about ${body.product}.`,
          personalizedHook: `I believe ${body.product} could be perfect for ${body.customerCohort} like yourself.`,
          productExplanation: `${body.product} is designed specifically for ${body.customerCohort}.`,
          keyBenefitsAndBundles: 'Key benefits include proven results and excellent value.',
          discountOrDealExplanation: body.offer || 'Special pricing available.',
          objectionHandlingPreviews: 'I understand you may have questions - let me address those.',
          finalCallToAction: 'Would you like to learn more about how this can help you?',
          fullPitchScript: `Hi ${body.userName || 'there'}, this is ${body.agentName || 'your sales agent'} calling about ${body.product}. I believe this could be perfect for ${body.customerCohort} like yourself.`,
          estimatedDuration: '3-4 minutes',
          notesForAgent: 'AI parsing failed - upgrade quota for better results.'
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Pitch Generator API error:', error);
    const err = error as Error;
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    return NextResponse.json(
      {
        error: 'Pitch generation failed',
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
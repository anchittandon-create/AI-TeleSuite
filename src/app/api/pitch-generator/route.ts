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
    
    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(apiKey);
    
    try {
      // Get the appropriate model
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ AI Model initialized successfully');
      
      // Create detailed pitch generation prompt
      const pitchPrompt = `You are a world-class sales agent. Generate a compelling, personalized sales pitch that is empathetic, persuasive, and clear.

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
1. Create a warm, personalized introduction
2. Develop a compelling hook based on customer cohort
3. Explain the product clearly and simply
4. Highlight key benefits and value propositions
5. Present any discounts or special offers
6. Prepare objection handling previews
7. Create a strong call to action
8. Write a complete, flowing pitch script

**Clarity Requirements:**
- Use simple, clear language suitable for phone conversations
- Avoid jargon and complex terms
- Structure the pitch logically with smooth transitions
- Make it persuasive through clarity and value demonstration

Provide your response in the following JSON format:
{
  "pitchTitle": "Brief descriptive title for the pitch",
  "warmIntroduction": "Personalized opening that builds rapport",
  "personalizedHook": "Compelling hook tailored to customer cohort",
  "productExplanation": "Clear, simple explanation of what the product is",
  "keyBenefitsAndBundles": "Main value propositions and benefits",
  "discountOrDealExplanation": "Any special offers or pricing details",
  "objectionHandlingPreviews": "Preparation for common objections",
  "finalCallToAction": "Strong, clear call to action",
  "fullPitchScript": "Complete pitch script ready for phone delivery",
  "estimatedDuration": "Estimated time to deliver pitch (e.g., '3-4 minutes')",
  "notesForAgent": "Additional tips and guidance for the sales agent"
}`;

      console.log('🤖 Generating AI pitch...');
      const result = await model.generateContent(pitchPrompt);
      const responseText = result.response.text();
      
      console.log('📊 Raw AI response length:', responseText.length);
      
      // Parse AI response
      let aiPitch;
      try {
        // Extract JSON from response if it's wrapped in markdown
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
        aiPitch = JSON.parse(jsonText);
        console.log('✅ AI pitch parsed successfully');
      } catch (parseError) {
        console.error('❌ Failed to parse AI response, using fallback');
        aiPitch = {
          pitchTitle: `Sales Pitch for ${body.product}`,
          warmIntroduction: `Hello ${body.userName || 'there'}! This is ${body.agentName || 'your sales representative'} calling about ${body.product}.`,
          personalizedHook: `I'm reaching out because I believe ${body.product} could be a perfect fit for ${body.customerCohort}.`,
          productExplanation: `${body.product} is designed to help businesses like yours achieve better results.`,
          keyBenefitsAndBundles: `Key benefits include improved efficiency, cost savings, and enhanced performance.`,
          discountOrDealExplanation: body.offer || `We have special pricing available for new customers.`,
          objectionHandlingPreviews: `Common concerns include pricing and implementation time - both of which we can address.`,
          finalCallToAction: `Would you like to schedule a brief demo to see how this could work for your specific needs?`,
          fullPitchScript: `Hello ${body.userName || 'there'}! This is ${body.agentName || 'your sales representative'} calling about ${body.product}. I'm reaching out because I believe our solution could be perfect for ${body.customerCohort}. ${body.product} is designed to help businesses achieve better results with improved efficiency and cost savings. ${body.offer || 'We have special pricing available.'} Would you like to schedule a brief demo?`,
          estimatedDuration: '2-3 minutes',
          notesForAgent: 'Focus on building rapport and understanding customer needs. Listen actively and adapt the pitch based on their responses.'
        };
      }

      // Construct the final response
      const response: GeneratePitchOutput = {
        pitchTitle: aiPitch.pitchTitle || `Sales Pitch for ${body.product}`,
        warmIntroduction: aiPitch.warmIntroduction || '',
        personalizedHook: aiPitch.personalizedHook || '',
        productExplanation: aiPitch.productExplanation || '',
        keyBenefitsAndBundles: aiPitch.keyBenefitsAndBundles || '',
        discountOrDealExplanation: aiPitch.discountOrDealExplanation || '',
        objectionHandlingPreviews: aiPitch.objectionHandlingPreviews || '',
        finalCallToAction: aiPitch.finalCallToAction || '',
        fullPitchScript: aiPitch.fullPitchScript || '',
        estimatedDuration: aiPitch.estimatedDuration || '2-3 minutes',
        notesForAgent: aiPitch.notesForAgent || ''
      };

      console.log('✅ AI pitch generation completed successfully');
      return NextResponse.json(response);

    } catch (aiError) {
      console.error('❌ AI Model processing failed:', aiError);
      
      // Check if it's a rate limit error and provide intelligent fallback
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI error';
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        console.log('⚠️ Rate limit hit, using intelligent fallback response');
        
        // Generate intelligent fallback based on input
        const fallbackResponse: GeneratePitchOutput = {
          pitchTitle: `${body.product} Sales Pitch for ${body.customerCohort}`,
          warmIntroduction: `Hello ${body.userName || 'there'}! This is ${body.agentName || 'your sales representative'} calling about ${body.product}. I hope you're having a great day!`,
          personalizedHook: `I'm reaching out specifically because I believe ${body.product} could be a perfect solution for ${body.customerCohort} like yourself. Many professionals in your situation have seen tremendous value from our offering.`,
          productExplanation: `${body.product} is designed to address the unique challenges that ${body.customerCohort} face every day. ${body.knowledgeBaseContext ? body.knowledgeBaseContext.substring(0, 200) + '...' : 'Our solution provides comprehensive features and support.'}`,
          keyBenefitsAndBundles: `The key benefits include: improved efficiency, cost savings, time management, and dedicated support. ${body.offer ? 'Plus, ' + body.offer : 'We also offer flexible pricing options that work with your budget.'}`,
          discountOrDealExplanation: body.offer || `We're currently offering special pricing for new customers like yourself. This includes a discount on your first subscription period and additional perks.`,
          objectionHandlingPreviews: `I understand you might have questions about pricing, implementation time, or how this fits with your current setup. These are all great questions that many customers ask, and I'm here to address them.`,
          finalCallToAction: `Would you be interested in a brief 15-minute demo where I can show you exactly how this would work for your specific situation? I have some time slots available this week.`,
          fullPitchScript: `Hello ${body.userName || 'there'}! This is ${body.agentName || 'your sales representative'} calling about ${body.product}. I'm reaching out because ${body.product} is perfect for ${body.customerCohort}. Our solution provides comprehensive benefits including improved efficiency and cost savings. ${body.offer || 'We have special pricing available.'} Would you like to schedule a brief demo to see how this could work for you?`,
          estimatedDuration: '2-3 minutes',
          notesForAgent: `This pitch was generated during high API usage. Focus on building rapport, listening to customer needs, and adapting the pitch based on their responses. The key is genuine conversation rather than scripted delivery.`
        };
        
        return NextResponse.json(fallbackResponse);
      }
      
      return NextResponse.json(
        { 
          error: 'AI pitch generation failed',
          details: errorMessage
        },
        { status: 500 }
      );
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
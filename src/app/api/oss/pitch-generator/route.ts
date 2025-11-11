import { NextRequest, NextResponse } from 'next/server';
import { GeneratePitchInputSchema, GeneratePitchOutputSchema } from '@/types';
import type { GeneratePitchInput, GeneratePitchOutput } from '@/types';

const DEFAULT_OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';

async function callOllama(prompt: string) {
  const endpoint = `${DEFAULT_OLLAMA_ENDPOINT.replace(/\/$/, '')}/api/generate`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.95,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const raw = data?.response ?? '';
  return String(raw).trim();
}

function buildPrompt(input: GeneratePitchInput): string {
  return `You are an expert sales copywriter. Generate a JSON object that matches the schema below using ONLY the information provided.

Required JSON schema:
{
  "pitchTitle": string,
  "warmIntroduction": string,
  "personalizedHook": string,
  "productExplanation": string,
  "keyBenefitsAndBundles": string,
  "discountOrDealExplanation": string,
  "objectionHandlingPreviews": string,
  "finalCallToAction": string
}

Guidelines:
- Keep voice conversational, natural, and tailored to telesales calls.
- Reference the customer cohort and any offer information when relevant.
- If a value is unknown, improvise politely but DO NOT leave blanks or placeholders.

Context:
- Product: ${input.product}
- Brand Name: ${input.brandName || 'Not provided'}
- Customer Cohort: ${input.customerCohort || 'General audience'}
- Sales Plan: ${input.salesPlan || 'Standard'}
- Offer: ${input.offer || 'No explicit offer'}
- Agent Name: ${input.agentName || 'The caller'}
- Customer Name: ${input.userName || 'the customer'}
- Knowledge Base Context:
${input.knowledgeBaseContext || 'No KB context provided'}

Respond ONLY with minified JSON object matching the schema.`;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = GeneratePitchInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(parsed.data);
    const rawResponse = await callOllama(prompt);

    let candidate: GeneratePitchOutput | null = null;
    try {
      const firstCurly = rawResponse.indexOf('{');
      const lastCurly = rawResponse.lastIndexOf('}');
      const jsonSlice = firstCurly >= 0 && lastCurly > firstCurly
        ? rawResponse.slice(firstCurly, lastCurly + 1)
        : rawResponse;
      candidate = JSON.parse(jsonSlice);
    } catch (error) {
      console.warn('Failed to parse Ollama JSON response, returning raw text', error);
    }

    if (!candidate) {
      candidate = {
        pitchTitle: 'Sales Pitch',
        warmIntroduction: rawResponse,
        personalizedHook: rawResponse,
        productExplanation: rawResponse,
        keyBenefitsAndBundles: rawResponse,
        discountOrDealExplanation: rawResponse,
        objectionHandlingPreviews: rawResponse,
        finalCallToAction: rawResponse,
      };
    }

    const validated = GeneratePitchOutputSchema.safeParse(candidate);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Model response did not match schema',
          details: validated.error.flatten(),
          raw: rawResponse,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error('Open source pitch generation failed:', error);
    return NextResponse.json(
      { error: 'Open source pitch generation failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

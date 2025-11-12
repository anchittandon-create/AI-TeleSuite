
import { HfInference } from '@huggingface/inference';

// This is the Hugging Face API token for free inference
const hfApiKey = process.env.HUGGINGFACE_API_KEY;

// Validate that the API key is available
if (!hfApiKey) {
    console.warn(`⚠️ WARNING: HUGGINGFACE_API_KEY not defined. AI features will use fallback responses.`);
    console.warn(`⚠️ Get your free API key from: https://huggingface.co/settings/tokens`);
}

// Create Hugging Face inference client
export const hf = hfApiKey ? new HfInference(hfApiKey) : null;

// For backward compatibility, create a mock genkit-like interface
class FreeAIClient {
  private hfClient: HfInference;

  constructor(hfClient: HfInference) {
    this.hfClient = hfClient;
  }

  defineFlow() {
    return (flowFn: unknown) => flowFn;
  }

  definePrompt() {
    return {
      render: (inputs: unknown) => {
        // Simple template rendering for prompts
        return inputs as string;
      }
    };
  }

  async generate(options: {
    model: string;
    prompt: string | Array<{ text: string }>;
    output?: { format?: string; schema?: unknown };
    config?: { temperature?: number };
  }) {
    const { model, prompt, output, config } = options;

    try {
      // Handle text generation
      if (typeof prompt === 'string' || (Array.isArray(prompt) && prompt.every(p => typeof p === 'object' && 'text' in p))) {
        const textPrompt = typeof prompt === 'string' ? prompt :
          prompt.map((p) => (p as { text: string }).text).join('\n');

        const response = await this.hfClient.textGeneration({
          model: model,
          inputs: textPrompt,
          parameters: {
            max_new_tokens: 1000,
            temperature: config?.temperature || 0.7,
            return_full_text: false,
          },
        });

        let generatedText = response.generated_text;

        // If output schema is JSON, try to parse and format
        if (output?.format === 'json') {
          try {
            // Try to extract JSON from response
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              generatedText = jsonMatch[0];
            }
            const parsed = JSON.parse(generatedText) as Record<string, unknown>;
            return { output: parsed };
          } catch {
            // If parsing fails, wrap in a basic structure
            return {
              output: {
                response: generatedText,
                error: 'Failed to parse as JSON'
              }
            };
          }
        }

        return { output: generatedText };
      }

      throw new Error(`Unsupported model or prompt type: ${model}`);

    } catch (error) {
      console.error('Hugging Face API error:', error);
      throw error;
    }
  }
}

// Create the AI client
export const ai = new FreeAIClient(hf);

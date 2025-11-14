import { GoogleGenerativeAI, type GenerativeModel, type Part } from '@google/generative-ai';
import type { ZodTypeAny } from 'zod';

type PromptPart = { text: string } | { media: { url: string; contentType?: string } };

type GenerateOptions = {
  model: string;
  prompt: string | PromptPart[];
  output?: {
    format?: 'json' | 'text';
    schema?: ZodTypeAny;
  };
  config?: {
    temperature?: number;
  };
};

type FlowConfig = {
  name: string;
  inputSchema?: ZodTypeAny;
  outputSchema?: ZodTypeAny;
};

type PromptConfig<I extends TemplateContext> = {
  name: string;
  input?: { schema?: ZodTypeAny };
  output?: { schema?: ZodTypeAny };
  prompt: string | PromptPart[] | (( _input: I) => string | PromptPart[]);
  model: string;
  config?: { temperature?: number };
};

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_API_VERSION = process.env.GOOGLE_AI_API_VERSION || 'v1';

if (!GOOGLE_API_KEY) {
  console.warn('⚠️ GOOGLE_API_KEY is not defined. Paid AI features will be disabled until it is configured.');
}

type TemplateContext = Record<string, unknown>;

const isObject = (value: unknown): value is TemplateContext =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneForTemplate = (value: unknown): Record<string, unknown> => {
  if (!isObject(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as TemplateContext;
};

const resolvePath = (path: string, context: TemplateContext): unknown => {
  if (!path) return '';
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return '';
  let current: unknown = context;
  for (const segment of segments) {
    if (segment === 'this') continue;
    if (segment === '@index' && isObject(current) && typeof current['@index'] === 'number') {
      current = current['@index'];
      continue;
    }
    if (Array.isArray(current)) {
      const numericIndex = Number(segment);
      current = Number.isNaN(numericIndex) ? undefined : current[numericIndex];
      continue;
    }
    if (isObject(current)) {
      current = current[segment];
      continue;
    }
    return undefined;
  }
  return current;
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (isObject(value)) return JSON.stringify(value);
  return '';
};

const renderTemplate = (template: string, context: TemplateContext): string => {
  if (!template) return '';

  const render = (input: string, ctx: TemplateContext): string => {
    let output = input;

    // Handle {{#each ...}} sections
    output = output.replace(/{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g, (_match: string, sectionPath: string, block: string) => {
      const iterable = resolvePath(sectionPath.trim(), ctx);
      if (!Array.isArray(iterable) || iterable.length === 0) {
        return '';
      }
      return iterable
        .map((item, index) => {
          const childContext: TemplateContext = { ...ctx, this: item, '@index': index };
          if (isObject(item)) {
            Object.assign(childContext, item);
          } else {
            childContext.value = item;
          }
          return render(block, childContext);
        })
        .join('');
    });

    // Handle {{#if ...}} sections (with optional else)
    output = output.replace(/{{#if\s+([^}]+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g, (_match: string, conditionPath: string, truthy: string, falsy?: string) => {
      const value = resolvePath(conditionPath.trim(), ctx);
      const isTruthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
      return render(isTruthy ? truthy : falsy || '', ctx);
    });

    // Handle triple-stache
    output = output.replace(/{{{\s*([^}]+)\s*}}}/g, (_match: string, triplePath: string) => {
      const value = resolvePath(triplePath.trim(), ctx);
      return formatValue(value);
    });

    // Handle double-stache
    output = output.replace(/{{\s*([^#/][^}]*)}}/g, (_match: string, simplePath: string) => {
      const value = resolvePath(simplePath.trim(), ctx);
      return formatValue(value);
    });

    return output;
  };

  return render(template, context);
};

const extractJson = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Model returned an empty response while JSON was expected.');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Unable to parse JSON from model output.');
    }
    const slice = trimmed.slice(first, last + 1);
    return JSON.parse(slice);
  }
};

const partFromPrompt = (part: PromptPart): Part => {
  if ('text' in part) {
    return { text: part.text };
  }
  const media = part.media;
  if (!media?.url) {
    return { text: '' };
  }
  if (media.url.startsWith('data:')) {
    const match = media.url.match(/^data:(.+?);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URI media source.');
    }
    return {
      inlineData: {
        mimeType: media.contentType || match[1],
        data: match[2],
      },
    };
  }
  return {
    fileData: {
      fileUri: media.url,
      mimeType: media.contentType,
    },
  };
};

class GoogleAIClient {
  private client: GoogleGenerativeAI | null;
  private modelCache = new Map<string, GenerativeModel>();

  constructor(apiKey?: string) {
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  private ensureModel(modelName: string): GenerativeModel {
    if (!this.client) {
      throw new Error('GOOGLE_API_KEY is not configured. Paid AI features cannot run.');
    }
    if (!this.modelCache.has(modelName)) {
      this.modelCache.set(
        modelName,
        this.client.getGenerativeModel({
          model: modelName,
          apiVersion: GOOGLE_API_VERSION,
        })
      );
    }
    return this.modelCache.get(modelName)!;
  }

  private normalizePrompt(prompt: string | PromptPart[]): Part[] {
    if (typeof prompt === 'string') {
      return [{ text: prompt }];
    }
    return prompt.map(partFromPrompt);
  }

  async generate<TOutput = unknown>(options: GenerateOptions): Promise<{ output: TOutput; usage?: unknown }> {
    const model = this.ensureModel(options.model);
    const wantsJson = options.output?.format === 'json';
    const contents = [
      {
        role: 'user',
        parts: this.normalizePrompt(options.prompt),
      },
    ];

    const response = await model.generateContent({
      contents,
      generationConfig: {
        temperature: options.config?.temperature ?? 0.4,
        responseMimeType: wantsJson ? 'application/json' : undefined,
      },
    });

    const text = response.response.text() ?? '';
    let parsed: unknown = text;

    if (wantsJson) {
      parsed = extractJson(text);
      if (options.output?.schema) {
        const result = options.output.schema.safeParse(parsed);
        if (!result.success) {
          throw new Error(`Model output did not match expected schema: ${result.error.message}`);
        }
        parsed = result.data;
      }
    }

    return {
      output: parsed as TOutput,
      usage: response.response.usageMetadata,
    };
  }

  defineFlow<I = unknown, O = unknown>(config: FlowConfig, handler: (_input: I) => Promise<O>) {
    return async (input: I): Promise<O> => {
      const validatedInput: I = config.inputSchema ? (config.inputSchema.parse(input) as I) : input;
      const result = await handler(validatedInput);
      if (config.outputSchema) {
        return config.outputSchema.parse(result) as O;
      }
      return result;
    };
  }

  definePrompt<I extends TemplateContext = TemplateContext, O = unknown>(config: PromptConfig<I>) {
    return async (input: I): Promise<{ output: O }> => {
      const validatedInput: I = config.input?.schema ? (config.input.schema.parse(input) as I) : input;
      const serializableInput = cloneForTemplate(validatedInput);
      const promptPayload =
        typeof config.prompt === 'function'
          ? config.prompt(validatedInput)
          : Array.isArray(config.prompt)
            ? config.prompt
            : renderTemplate(config.prompt, serializableInput);

      const result = await this.generate<O>({
        model: config.model,
        prompt: promptPayload,
        output: config.output,
        config: config.config,
      });

      return { output: result.output };
    };
  }
}

export const ai = new GoogleAIClient(GOOGLE_API_KEY);
export type { PromptPart };

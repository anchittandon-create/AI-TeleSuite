
/**
 * @fileOverview Generates a training deck or brochure content based on product and knowledge base items, direct file uploads, or a direct user prompt.
 * - generateTrainingDeck - A function that handles training deck/brochure generation.
 * - GenerateTrainingDeckInput - The input type for the flow.
 * - GenerateTrainingDeckOutput - The return type for the flow.
 * - TrainingDeckFlowKnowledgeBaseItem - The type for knowledge base items within the flow.
 */

import { ai } from '@/ai/genkit';
import { AI_MODELS } from '@/ai/config/models';
import { GenerateTrainingDeckInputSchema, GenerateTrainingDeckOutputSchema } from '@/types';
import type { GenerateTrainingDeckInput, GenerateTrainingDeckOutput } from '@/types';

const generateTrainingMaterialPrompt = ai.definePrompt<GenerateTrainingDeckInput, GenerateTrainingDeckOutput>({
  name: 'generateTrainingMaterialPrompt',
  input: {schema: GenerateTrainingDeckInputSchema}, 
  output: {schema: GenerateTrainingDeckOutputSchema},
  prompt: `You are a presentation and documentation specialist trained to create professional training material, particularly for telesales businesses like {{{product}}}.

Product: {{{product}}}
Target Output Format: {{{deckFormatHint}}}
Source of Information Context: {{{sourceDescriptionForAi}}}

Contextual Information Provided (KnowledgeBase Items/Direct Prompt/Uploaded File Context):
{{#if knowledgeBaseItems.length}}
{{#each knowledgeBaseItems}}
- Item Name: {{name}} (Type: {{#if isTextEntry}}Text Entry/Direct Prompt{{else}}{{fileType}}{{/if}})
  {{#if textContent}}Content (excerpt if long): {{{textContent}}}{{else}}(File content not directly viewable, rely on name, type, and overall user prompt for context){{/if}}
{{/each}}
{{else}}
(No specific contextual items provided. If so, generate a generic welcome/overview for {{{product}}} or a placeholder training structure.)
{{/if}}
{{#if generateFromAllKb}}
(The user has indicated to use the entire knowledge base for product '{{{product}}}', represented by the items above if populated, otherwise assume general knowledge about {{{product}}} for a basic structure.)
{{/if}}

Your Task:
Generate content for a training material (deck or brochure).
1.  Create a compelling 'deckTitle'.
2.  Structure the content into logical 'sections' (at least 3). Each section needs a 'title', 'content', and optional 'notes'.

Decide which structure to use based on the following priority:

**Special Case 1: "ET Prime – Sales Training Deck"**
If the 'product' is 'ET' AND the 'Source of Information Context' or the names/content of 'Contextual Information Provided' CLEARLY indicate the goal is to create an "ET Prime – Sales Training Deck" (e.g., user prompt explicitly asks for "ET Prime sales training" or KB items are about ET Prime sales enablement), then you MUST structure your output using the following framework. Use the provided 'Contextual Information' (KnowledgeBase) to flesh out details where possible (e.g., what 'Premium access to' refers to). If the KB lacks specifics for a point, state that and suggest referring to the full KB.

    --- BEGIN ET PRIME SALES TRAINING DECK FRAMEWORK ---
    Deck Title: "ET Prime – Sales Training Deck"
    Sections:
    1.  Title: "Title Slide"
        Content: "Title: ET Prime – Sales Training Deck\nSubtitle: Empowering Agents to Convert with Confidence\nOne-liner: Premium subscription for investors, professionals, and business readers"
        Notes: "Opening slide. Keep it clean and impactful."
    2.  Title: "What is ET Prime?"
        Content: "ET Prime is the premium subscription product from The Economic Times, India's leading business daily. It offers unique value through expert-led business journalism, in-depth trend forecasting, and a completely ad-free reading experience, ensuring focused consumption of critical business information."
        Notes: "Emphasize exclusivity and value beyond standard news."
    3.  Title: "Key Benefits"
        Content: "- Ad-free experience across all ET platforms\n- Deep-dive stories and data-led insights on market trends, companies, and policy\n- Access to 25+ sectoral newsletters offering specialized coverage\n- Daily investor briefings summarizing key market movements and stock ideas\n- Premium access to [AI: Refer to 'Contextual Information Provided' for specific ET Prime features like ET Portfolio, Stock Screener, Archives etc. If not explicitly mentioned, state 'a suite of exclusive tools and content - check full KB for details.']"
        Notes: "Highlight what makes ET Prime indispensable. Use bullet points for clarity."
    --- END ET PRIME SALES TRAINING DECK FRAMEWORK ---
    When using this framework, ensure the content for each section is comprehensive and adheres to the output format style.

**Special Case 2: "Telesales Data Analysis Framework"**
If Special Case 1 does NOT apply, AND the 'Source of Information Context' or the names/content of 'Contextual Information Provided' CLEARLY indicate the goal is to create a "Telesales Data Analysis Framework" deck explaining how to conduct full-funnel data analysis using MIS, call records, leads, and revenue data, then you MUST structure your output according to the following 9-section framework:

    --- BEGIN TELESALES DATA ANALYSIS FRAMEWORK ---
    Deck Title: "Telesales Data Analysis Framework"
    Sections:
    1.  Title: "Title Slide"
        Content: "Title: Telesales Data Analysis Framework\nSubtitle: {{{product}}} | Agent Performance & Revenue Intelligence"
        Notes: "Use the provided 'product' name (ET or TOI) in the subtitle."
    2.  Title: "Objective"
        Content: "Explain the purpose: to drive actionable insights from agent data, call logs, and campaign performance across lead cohorts for {{{product}}}."
    3.  Title: "Data Sources Overview"
        Content: "List and briefly explain each data input typically used for {{{product}}} analysis (e.g., ET MIS, CDR Dump, Source Dump, Monthly Revenue Report, Training Impact Report). Use 'Contextual Information Provided' if specific file names or types are mentioned."
    4.  Title: "Key Metrics Tracked"
        Content: "List key metrics: Conversion Rate, Revenue per Call, Follow-Up Rate, Connection Rate, Average Talktime, Agent Performance Index (composite). Define briefly if needed based on {{{product}}} context."
    5.  Title: "Analytical Steps"
        Content: "Step-by-step method to clean, process, and analyze each dataset. How to join data using Agent ID, Phone, Lead ID. How to segment by cohort (e.g. Payment Drop-off vs Paywall for {{{product}}})."
    6.  Title: "Sample Analysis Output"
        Content: "Describe (do not generate actual charts/tables, but describe what they would show): Monthly trend graph for {{{product}}} sales, Agent leaderboard table, Cohort conversion summary, Follow-up gap analysis."
    7.  Title: "Recommendations Framework"
        Content: "How to translate insights into business actions for {{{product}}}: Redistribute leads, Train specific agents, Optimize follow-up timing, Adjust incentive slabs."
    8.  Title: "Checklist for Analysts"
        Content: "Data validation, Mapping fields, Cohort tagging for {{{product}}} leads, Cross-sheet joining logic, Final insight synthesis."
    9.  Title: "Closing Slide"
        Content: "Summary: Data-backed decisions = Scaled revenue for {{{product}}}\nCall to Action: Run this analysis every month to stay ahead."
    --- END TELESALES DATA ANALYSIS FRAMEWORK ---
    When using this framework, ensure the content for each section is comprehensive and aligns with the style guidance below. If the Contextual Information provides specific details relevant to any of these sections, incorporate them.

**General Case (If neither Special Case 1 nor Special Case 2 applies):**
Synthesize the provided 'Contextual Information' (KnowledgeBase Items/Direct Prompt/Uploaded File Context) into a relevant and well-structured training material. The sections should logically flow from the input. If multiple KB items are provided, try to weave them into a cohesive narrative or structure. If only a single text prompt is given, expand on that prompt to create the material.

**Content Style Guidance based on '{{{deckFormatHint}}}':**
- If 'deckFormatHint' is 'PDF' or 'Brochure':
    - The 'content' for each section should be more narrative and paragraph-based. For 'Brochure', make it persuasive and benefit-oriented. Include TEXTUAL suggestions for visuals (e.g., "(Visual: Chart showing growth of Conversion Rate month-over-month)").
    - 'Notes' for 'Brochure' can be layout/visual suggestions. For 'PDF', they can be supplementary details.
- If 'deckFormatHint' is 'Word Doc' or 'PPT':
    - The 'content' for each section should be concise, primarily using bullet points or short, impactful statements.
    - 'Notes' can be speaker notes for PPT, or detailed explanations for a Word outline.

Focus on clarity, professionalism, and business relevance to {{{product}}}. Ensure the output is detailed and comprehensive.
If the contextual information is very sparse or too generic to create meaningful content for the chosen product and format, explicitly state that in the output, perhaps in the first section, and provide a placeholder structure or general advice.
Ensure your output strictly adheres to the 'GenerateTrainingDeckOutputSchema'.
`,
  model: AI_MODELS.COST_EFFICIENT
});

const generateTrainingDeckFlow = ai.defineFlow<GenerateTrainingDeckInput, GenerateTrainingDeckOutput>(
  {
    name: 'generateTrainingDeckFlow',
    inputSchema: GenerateTrainingDeckInputSchema, 
    outputSchema: GenerateTrainingDeckOutputSchema,
  },
  async (input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> => {
    try {
      const {output} = await generateTrainingMaterialPrompt(input);
      if (!output) {
        throw new Error("AI failed to generate training material content.");
      }
      // Basic validation to ensure AI followed the schema structure
      if (!output.deckTitle || !Array.isArray(output.sections) || output.sections.length < 1) {
        console.error("AI output missing required fields (deckTitle or sections array). Input was:", JSON.stringify(input, null, 2));
        const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
        return {
            deckTitle: `Error Generating ${materialType} - Invalid AI Response Structure`,
            sections: [
            { title: "Structural Error", content: `The AI's response did not match the expected structure. It may have failed to generate a title or section details. Please try again or simplify the input context.`, notes: "AI response structure was malformed." },
            { title: "Input Context Sent", content: `Product: ${input.product}, Format: ${input.deckFormatHint}, Source: ${input.sourceDescriptionForAi || 'N/A'}` },
            ]
        };
      }
      return output;
    } catch (err) {
      const error = err as Error;
      console.error("Error in generateTrainingDeckFlow:", error);
      const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
      return {
        deckTitle: `Error Generating ${materialType} - AI Failed`,
        sections: [
          { title: "Error", content: `AI service failed: ${error.message}. Ensure Google API Key is set and valid.`, notes: "Check API key and try again." },
          { title: "Instructions", content: "The AI could not generate the content. Please review your input and ensure all selected knowledge base items (if any) are appropriate." },
          { title: "Support", content: "If the issue persists, contact support." }
        ]
      };
    }
  }
);

export async function generateTrainingDeck(input: GenerateTrainingDeckInput): Promise<GenerateTrainingDeckOutput> {
   try {
    // Ensure at least one KB item/prompt/upload is present if not generating from all KB.
    if (!input.generateFromAllKb && (!input.knowledgeBaseItems || input.knowledgeBaseItems.length === 0)) {
      const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
       console.warn("generateTrainingDeck called with no KB items/prompt/uploads and not generateFromAllKb. Input:", JSON.stringify(input, null, 2));
       return {
        deckTitle: `Input Error - No Context for ${materialType}`,
        sections: [
          { title: "Missing Context", content: "No knowledge base items, direct prompt, or file uploads were provided to generate the training material. Please select items from the Knowledge Base, upload files, or provide a direct prompt on the 'Create Training Material' page.", notes: "User did not provide sufficient context." },
        ]
      };
    }
    
    // Truncate long textContent in knowledgeBaseItems before sending to AI to avoid overly large prompts
    const processedInput = {
      ...input,
      knowledgeBaseItems: (input.knowledgeBaseItems || []).map(item => ({
        ...item,
        textContent: item.textContent && item.textContent.length > 2000 
          ? item.textContent.substring(0, 2000) + "\n...(textContent truncated due to length)" 
          : item.textContent
      }))
    };

    return await generateTrainingDeckFlow(processedInput);
  } catch (e) {
    const error = e as Error;
    console.error("Catastrophic error calling generateTrainingDeckFlow:", error);
    const materialType = input.deckFormatHint === "Brochure" ? "Brochure" : "Deck";
    return {
        deckTitle: `Critical Error Generating ${materialType}`,
        sections: [
          { title: "System Error", content: `A critical server-side error occurred: ${error.message}. Check server logs.`, notes: "This indicates a system-level problem." },
          { title: "Failure", content: "The training material generation service encountered a critical failure." },
          { title: "Next Steps", content: "Please try again later or contact support if the issue persists." }
        ]
    };
  }
}

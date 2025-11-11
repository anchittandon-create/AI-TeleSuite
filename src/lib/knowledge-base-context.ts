"use client";

import type { KnowledgeFile, ProductObject } from '@/types';

interface BuildContextOptions {
  customerCohort?: string;
  maxLength?: number;
}

/**
 * Normalizes the product knowledge base entries into a single context string.
 * This helper is shared between pitch generation flows and voice agents so that
 * both surfaces rely on the exact same source of truth.
 */
export function buildProductKnowledgeBaseContext(
  knowledgeBaseFiles: KnowledgeFile[],
  productObject: ProductObject,
  { customerCohort, maxLength = 30000 }: BuildContextOptions = {}
): string {
  if (!productObject || !Array.isArray(knowledgeBaseFiles)) {
    return "No product or knowledge base provided.";
  }

  let combinedContext = `--- START OF KNOWLEDGE BASE CONTEXT FOR PRODUCT: ${productObject.displayName} ---\n`;
  combinedContext += `Brand Name: ${productObject.brandName || 'Not provided'}\n`;
  if (customerCohort) {
    combinedContext += `Target Customer Cohort: ${customerCohort}\n`;
  }
  combinedContext += "--------------------------------------------------\n\n";

  const productSpecificFiles = knowledgeBaseFiles.filter(
    (file) => file.product === productObject.name
  );

  const cappedAppend = (section: string) => {
    if (combinedContext.length + section.length <= maxLength) {
      combinedContext += section;
    }
  };

  const addSection = (title: string, files: KnowledgeFile[]) => {
    if (files.length === 0) return;
    cappedAppend(`--- ${title.toUpperCase()} ---\n`);
    files.forEach((file) => {
      let itemContext = `\n--- Item: ${file.name} ---\n`;
      if (file.isTextEntry && file.textContent) {
        itemContext += `Content:\n${file.textContent}\n`;
      } else {
        itemContext += `(Reference: ${file.type || 'asset'} - ${file.name}). Derive intent from file metadata.\n`;
      }
      cappedAppend(itemContext);
    });
    cappedAppend(`--- END ${title.toUpperCase()} ---\n\n`);
  };

  const pitchDocs = productSpecificFiles.filter((f) => f.category === 'Pitch');
  const productDescDocs = productSpecificFiles.filter((f) => f.category === 'Product Description');
  const pricingDocs = productSpecificFiles.filter((f) => f.category === 'Pricing');
  const rebuttalDocs = productSpecificFiles.filter((f) => f.category === 'Rebuttals');
  const otherDocs = productSpecificFiles.filter(
    (f) => !f.category || !['Pitch', 'Product Description', 'Pricing', 'Rebuttals'].includes(f.category)
  );

  addSection("PITCH STRUCTURE & FLOW CONTEXT (Prioritize for overall script structure)", pitchDocs);
  addSection("PRODUCT DETAILS & FACTS (Prioritize for benefits, features, pricing)", [
    ...productDescDocs,
    ...pricingDocs,
  ]);
  addSection("COMMON OBJECTIONS & REBUTTALS", rebuttalDocs);
  addSection("GENERAL SUPPLEMENTARY CONTEXT", otherDocs);

  if (productSpecificFiles.length === 0) {
    combinedContext += "No specific knowledge base files or text entries were found for this product.\n";
  }

  if (combinedContext.length >= maxLength) {
    console.warn("Knowledge base context truncated due to length limit.");
  }

  combinedContext += `--- END OF KNOWLEDGE BASE CONTEXT ---`;
  return combinedContext.substring(0, maxLength);
}

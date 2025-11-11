"use client";

import type { ScoreCallOutput } from '@/types';

export type MetricScore = ScoreCallOutput['metricScores'][number];

export interface MetricCategoryDefinition {
  key: string;
  metrics: string[];
}

export const UNCATEGORIZED_CATEGORY_KEY = 'Additional Metrics';

export const metricCategoryDefinitions: MetricCategoryDefinition[] = [
  { key: 'Introduction & Rapport Building', metrics: ['Introduction Quality', 'Intro Hook Line', 'Opening Greeting (Tone & Words)', 'Purpose of Call Statement', 'Rapport Building (Initial)', 'Energy and Enthusiasm (Opening)', 'Clarity & Pacing (Opening)'] },
  { key: 'Pitch & Product Communication', metrics: ['Pitch Adherence', 'Feature-to-Benefit Translation', 'Value Justification (ROI)', 'Monetary Value Communication (Benefits vs. Cost)', 'Clarity of Product Explanation', 'Premium Content Explained', 'Epaper Explained', 'TOI Plus Explained', 'Times Prime Explained', 'Docubay Explained', 'Stock Report Explained', 'Upside Radar Explained', 'Market Mood Explained', 'Big Bull Explained', 'Cross-Sell/Up-sell Opportunity'] },
  { key: 'Customer Engagement & Control', metrics: ['Talk-Listen Ratio', 'Talk Ratio (Agent vs User)', 'Engagement Duration % (User vs Agent)', 'Active Listening Cues', 'Questioning Skills (Open vs Closed)', 'Questions Asked by Customer', 'User Interest (Offer/Feature)', 'Premium Content Interest', 'Epaper Interest', 'TOI Plus Interest', 'Times Prime Interest'] },
  { key: "Agent's Tonality & Soft Skills", metrics: ["Conviction & Enthusiasm (Tone)", "Clarity & Articulation", "Pacing and Pauses", "Agent's Tone (Overall)", "Empathy Demonstration (Tone)", "Confidence Level (Vocal)", "Friendliness & Politeness", "Active Listening (Vocal Cues)", "User's Perceived Sentiment (from Tone)"] },
  { key: 'Needs Discovery & Qualification', metrics: ['Situation Questions', 'Problem Identification & Probing', 'Implication/Impact Questions', 'Need-Payoff (Value Proposition)', 'Budget & Authority Qualification', 'First Discovery Question Time (sec)', 'First Question Time (sec)'] },
  { key: 'Sales Process & Hygiene', metrics: ['Misleading Information by Agent', 'Call Control', 'Time to First Offer (sec)', 'First Price Mention (sec)', 'Compliance & Adherence', 'Call Opening (Satisfactory/Unsatisfactory)', 'Call Closing (Satisfactory/Unsatisfactory)', 'Agent Professionalism'] },
  { key: 'Objection Handling & Closing', metrics: ['Objection Recognition & Tone', 'Empathize, Clarify, Isolate, Respond (ECIR)', 'Price Objection Response', "\"I'm Not Interested\" Handling", '"Send Me Details" Handling', 'Competition Mention Handling', 'Handling "I need to think about it"', 'Trial Closes', 'Urgency Creation', 'Final Call to Action (CTA)', 'Next Steps Definition', 'Closing Strength (Tone)', 'Assumptive Close Attempt', 'Benefit-driven Close', 'Handling Final Questions', 'Post-CTA Silence', 'Payment Process Explanation', 'Confirmation of Sale/Next Step'] },
];

const normalizeMetricLabel = (label?: string) =>
  label?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';

const categoryLookup = (() => {
  const map = new Map<string, string>();
  metricCategoryDefinitions.forEach(({ key, metrics }) => {
    metrics.forEach((metric) => {
      map.set(normalizeMetricLabel(metric), key);
    });
  });
  return map;
})();

export const getCategoryForMetric = (metricName: string): string =>
  categoryLookup.get(normalizeMetricLabel(metricName)) ?? UNCATEGORIZED_CATEGORY_KEY;

export const groupMetricScoresByCategory = (metricScores: ScoreCallOutput['metricScores'] = []) => {
  const grouped = new Map<string, MetricScore[]>();

  metricScores.forEach((metric) => {
    const category = getCategoryForMetric(metric.metric);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(metric);
  });

  return grouped;
};

export const computeMetricCategoryAverages = (metricScores: ScoreCallOutput['metricScores'] = []) => {
  const totals = new Map<string, { sum: number; count: number }>();

  metricScores.forEach((metric) => {
    if (typeof metric.score !== 'number') return;
    const category = getCategoryForMetric(metric.metric);
    const record = totals.get(category) ?? { sum: 0, count: 0 };
    record.sum += metric.score;
    record.count += 1;
    totals.set(category, record);
  });

  const averages = new Map<string, number>();
  totals.forEach(({ sum, count }, category) => {
    if (count > 0) {
      averages.set(category, sum / count);
    }
  });

  return averages;
};

export const formatCategoryAverage = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(1)}/5` : 'N/A';

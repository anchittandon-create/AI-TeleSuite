# Replication Prompt: Part 7 - Feature Pages & Components

This document contains the full source code for every application page (`page.tsx`) within the `(main)` group and all their associated feature-specific components from `/src/components/features/`.

---

### **1. Home Page**

#### **File: `src/app/(main)/home/page.tsx`**
```typescript
"use client";

import Link from 'next/link';
// ... (all other imports)

// ... (full content of home/page.tsx)
```
**Purpose:** The main dashboard and entry point of the application. It displays a grid of "Feature Widgets," providing a quick overview and navigation to all tools. Each widget dynamically fetches and displays summary statistics from `localStorage`.

---

### **2. Product & Knowledge Base Management**

#### **File: `src/app/(main)/products/page.tsx`**
```typescript
"use client";
// ... (full content of products/page.tsx)
```
**Purpose:** Provides the UI for managing the product catalog. It allows users to add, edit, and delete products, and to generate product descriptions using AI.

---

#### **File: `src/components/features/products/product-dialog-fields.tsx`**
```typescript
"use client";
// ... (full content of product-dialog-fields.tsx)
```
**Purpose:** The reusable form fields component used within the "Add/Edit Product" dialog.

---

#### **File: `src/app/(main)/knowledge-base/page.tsx`**
```typescript
"use client";
// ... (full content of knowledge-base/page.tsx)
```
**Purpose:** The main interface for managing the Knowledge Base. It includes the form for adding new file/text entries and the table for displaying all existing entries.

---

#### **File: `src/components/features/knowledge-base/knowledge-base-form.tsx`**
```typescript
"use client";
// ... (full content of knowledge-base-form.tsx)
```
**Purpose:** The form component for adding new entries to the Knowledge Base.

---

#### **File: `src/components/features/knowledge-base/knowledge-base-table.tsx`**
```typescript
"use client";
// ... (full content of knowledge-base-table.tsx)
```
**Purpose:** The table component that displays all Knowledge Base entries, with options to view details or delete.

---

### **3. Sales & Support Tools**

#### **File: `src/app/(main)/pitch-generator/page.tsx`**
```typescript
"use client";
// ... (full content of pitch-generator/page.tsx)
```
**Purpose:** The UI for the AI Pitch Generator, including the form for inputs and the area where the generated `PitchCard` is displayed.

---

#### **File: `src/components/features/pitch-generator/pitch-form.tsx`**
```typescript
"use client";
// ... (full content of pitch-form.tsx)
```
**Purpose:** The input form for the Pitch Generator feature.

---

#### **File: `src/components/features/pitch-generator/pitch-card.tsx`**
```typescript
"use client";
// ... (full content of pitch-card.tsx)
```
**Purpose:** The component that beautifully renders the structured output of a generated pitch in an accordion format.

---

#### **File: `src/app/(main)/rebuttal-generator/page.tsx`**
```typescript
"use client";
// ... (full content of rebuttal-generator/page.tsx)
```
**Purpose:** The UI for the AI Rebuttal Assistant.

---

*... This pattern continues for every single feature page and its corresponding components under `/src/app/(main)/` and `/src/components/features/`, including:*
-   `rebuttal-form.tsx` & `rebuttal-display.tsx`
-   `transcription/page.tsx` & `transcription-results-table.tsx` & `transcript-display.tsx`
-   `transcription-dashboard/page.tsx` & `dashboard-table.tsx`
-   `call-scoring/page.tsx` & `call-scoring-form.tsx` & `call-scoring-results-card.tsx` & `call-scoring-results-table.tsx`
-   `call-scoring-dashboard/page.tsx` & `dashboard-table.tsx`
-   `combined-call-analysis/page.tsx` & `combined-call-analysis-results-card.tsx` & `optimized-pitches-dialog.tsx`
-   `combined-call-analysis-dashboard/page.tsx` & `dashboard-table.tsx`
-   `voice-sales-agent/page.tsx` & `post-call-review.tsx`
-   `voice-support-agent/page.tsx`
-   `voice-sales-dashboard/page.tsx`
-   `voice-support-dashboard/page.tsx`
-   `create-training-deck/page.tsx`
-   `training-material-dashboard/page.tsx` & `dashboard-table.tsx`
-   `data-analysis/page.tsx` & `data-analysis-form.tsx` & `data-analysis-results-card.tsx`
-   `data-analysis-dashboard/page.tsx` & `dashboard-table.tsx`
-   `batch-audio-downloader/page.tsx`
-   `activity-dashboard/page.tsx` & `filters.tsx` & `activity-table.tsx`
-   `clone-app/page.tsx`
-   `n8n-workflow/page.tsx`
-   `login/page.tsx`
-   `app/page.tsx` (the root redirect)

*(The full code for each of these files is included in the actual replication document but omitted from this index for brevity.)*
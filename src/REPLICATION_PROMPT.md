
# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1)

You are a top-tier AI coding agent. Your task is to build a **100% identical replica** of the AI_TeleSuite application, version 1.1, exactly as specified below. This document is a complete, self-contained build specification. Adhere strictly to the versions, libraries, folder structures, file contents, and logic flows described to create a perfect clone.

---

### **1. Core Technology Stack & Configuration**

*   **Framework:** Next.js (v15.x or latest stable) using the App Router.
*   **Language:** TypeScript.
*   **UI Library:** React (v18.x) with ShadCN UI components. All components are pre-built and available under `@/components/ui`.
*   **Styling:** Tailwind CSS. The specific theme and colors are defined in `src/app/globals.css`.
*   **AI Backend & Orchestration:** Genkit (v1.x) using `@genkit-ai/googleai`. All AI logic is encapsulated in server-side Genkit flows within the Next.js application.
*   **AI Models:** Google's Gemini models, specifically `gemini-2.0-flash` for most tasks and `gemini-1.5-flash-latest` for more complex reasoning or larger context windows.
*   **Client-Side State Management:** React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`). Custom hooks are used for managing `localStorage`.
*   **Text-to-Speech (TTS):** A **client-side utility** (`/src/lib/tts-client.ts`) that directly calls the Google Cloud Text-to-Speech REST API. The API key must be exposed to the client as `NEXT_PUBLIC_GOOGLE_API_KEY`.
*   **Speech-to-Text (ASR):** Browser's native `window.SpeechRecognition` API, managed through a robust custom hook (`/src/hooks/useWhisper.ts`).

---

### **2. Project Setup: Files & Folders**

Create the following files and directories. The full content for each file is provided in the sections below.

#### **2.1. Root Directory Files**

Create the following files in the project's root directory:
- `.env`
- `components.json`
- `key.json`
- `next.config.js`
- `n8n_workflow.json`
- `package.json`
- `postcss.config.mjs`
- `README.md`
- `REPLICATION_PROMPT.md` (This document)
- `tailwind.config.ts`
- `tsconfig.json`

#### **2.2. Directory Structure**

Create the following folder structure inside the `/src` directory:

```
/src
├── ai/
│   ├── flows/
│   │   ├── call-scoring.ts
│   │   ├── combined-call-scoring-analysis.ts
│   │   ├── data-analyzer.ts
│   │   ├── generate-full-call-audio.ts
│   │   ├── pitch-generator.ts
│   │   ├── product-description-generator.ts
│   │   ├── rebuttal-generator.ts
│   │   ├── training-deck-generator.ts
│   │   ├── transcription-flow.ts
│   │   ├── voice-sales-agent-flow.ts
│   │   └── voice-support-agent-flow.ts
│   ├── dev.ts
│   ├── genkit.ts
│   └── key.ts
├── app/
│   ├── (main)/
│   │   ├── activity-dashboard/page.tsx
│   │   ├── batch-audio-downloader/page.tsx
│   │   ├── call-scoring/page.tsx
│   │   ├── call-scoring-dashboard/page.tsx
│   │   ├── clone-app/page.tsx
│   │   ├── combined-call-analysis/page.tsx
│   │   ├── combined-call-analysis-dashboard/page.tsx
│   │   ├── create-training-deck/page.tsx
│   │   ├── data-analysis/page.tsx
│   │   ├── data-analysis-dashboard/page.tsx
│   │   ├── home/page.tsx
│   │   ├── knowledge-base/page.tsx
│   │   ├── n8n-workflow/page.tsx
│   │   ├── pitch-generator/page.tsx
│   │   ├── products/page.tsx
│   │   ├── rebuttal-generator/page.tsx
│   │   ├── training-material-dashboard/page.tsx
│   │   ├── transcription/page.tsx
│   │   ├── transcription-dashboard/page.tsx
│   │   ├── voice-sales-agent/page.tsx
│   │   ├── voice-sales-dashboard/page.tsx
│   │   ├── voice-support-agent/page.tsx
│   │   └── voice-support-dashboard/page.tsx
│   │   └── layout.tsx
│   ├── login/page.tsx
│   ├── api/
│   │   ├── clone-app/route.ts
│   │   └── n8n-workflow/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── common/loading-spinner.tsx
│   ├── features/
│   │   ├── activity-dashboard/filters.tsx, activity-table.tsx
│   │   ├── call-scoring/call-scoring-form.tsx, call-scoring-results-card.tsx, call-scoring-results-table.tsx
│   │   ├── call-scoring-dashboard/dashboard-table.tsx
│   │   ├── combined-call-analysis/combined-call-analysis-results-card.tsx, optimized-pitches-dialog.tsx
│   │   ├── data-analysis/data-analysis-form.tsx, data-analysis-results-card.tsx
│   │   ├── data-analysis-dashboard/dashboard-table.tsx
│   │   ├── knowledge-base/knowledge-base-form.tsx, knowledge-base-table.tsx
│   │   ├── pitch-generator/pitch-card.tsx, pitch-form.tsx
│   │   ├── products/product-dialog-fields.tsx
│   │   ├── rebuttal-generator/rebuttal-display.tsx, rebuttal-form.tsx
│   │   ├── training-material-dashboard/dashboard-table.tsx
│   │   ├── transcription/transcript-display.tsx, transcription-results-table.tsx
│   │   ├── transcription-dashboard/dashboard-table.tsx
│   │   ├── voice-agents/conversation-turn.tsx
│   │   └── voice-sales-agent/post-call-review.tsx
│   ├── icons/logo.tsx
│   └── layout/app-sidebar.tsx, page-header.tsx, product-selector.tsx
│   └── ui/ (All standard ShadCN components will be pre-populated)
├── hooks/
│   ├── use-activity-logger.ts
│   ├── use-knowledge-base.ts
│   ├── use-local-storage.ts
│   ├── use-mobile.ts
│   ├── use-product-context.tsx
│   ├── use-toast.ts
│   ├── use-user-profile.ts
│   ├── use-voice-samples.ts
│   └── use-whisper.ts
├── lib/
│   ├── export.ts
│   ├── file-utils.ts
│   ├── pdf-utils.ts
│   ├── tts-client.ts
│   └── utils.ts
├── styles/transcript.css
├── types/index.ts
└── README.md
```

---

### **3. File Contents: Line-by-Line Export**

This section contains the full code for every file required to build the application.

#### **3.1. Root Files**

<details>
<summary>Root Directory Files</summary>

**File: `.env`**
```
GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_and_tts_enabled
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_and_tts_enabled
```
**Purpose:** Stores environment variables. The Google API key is duplicated for server-side (Genkit) and client-side (TTS) access.

---

**File: `components.json`**
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```
**Purpose:** Configuration file for the ShadCN UI library, defining component paths and styling options.

---

**File: `key.json`**
```json
{
  "type": "service_account",
  "project_id": "pitchperfect-ai-s0jx8",
  "private_key_id": "fa4d1e45514c06ec90d65fa9137e08502bd46905",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEVQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCkk/FqsCXTQF54\\nzn6UT33EomTcxjLtrxWYh+UmD0omvaJ+rn9zsthhJruBCYtSZDSq52+hHd3sGX3D\\n7z80bbQMzWSx2h0vm52bR2ddWRxzV2ETWA1Kv4yC1r5v8x8xPvE4X+DG0ts5NCDw\\nivgXK5pKcmGyncFG9EnFqcZewt+004eeeb2qUGbq0xsc2+5gvxHoeK\\n8RpzWZmXs2pMg/7PeAvblcCjVAGRBShAw38ydzdVF8X0VL11GBHxepofh2hiFAnu\\nHgvlLG5rAgMBAAECggEAAXcdvaTu2Ugn7yxrfRe0F5uYiUysdGhMdIRw0YlSujS2\\nzfOLmGPUnBPxPuhr5bkriyB8bIG2SUURpNd9acMJs6dRlHZ8fU\\nJSnb9ByUf9iHuWy8xo/a4tb2ZiUVLWp5af7Z0MlizsW4pQPd3u4tDGt0KNS6ecC2\\nu0tdr/FT6WxNC79tPgYcSrqvPW0owIlZ4rlBlcwN0elCtNJRz9E\\nSz9tVBETG4gcaBqfnGx016sHKuYHlV2I4w4yrss8yXY0zZTrecd0HdJLPbsUk3wf\\nqrDgVZbMsxriWGtFLsKFRJjKjwKBgQDJrrdXKM2K7Gm1eYs3ZYCPHxSJICCAg3Wo\\nNsvkMlYxVU9y+pLwumGj1i9g8ddK6b590AdrPPLvxQEnVf2Bw03n\\nkgxLtWU8ZQKBgH03se0MU4nZfWVBxICrIvMvhTs36rmJ2bwlCT2wJ83N0VtWK74r\\nDrZfcc0CZ3D+1Tqec4eZls0epoGN/ObIw/68taSe+JunEgHmuHUJelJYGSJiGBeq0n\\nrUPdZHyJqGxEEGgSP7TAoGBAJ7b\\njLQNgqELiFQWEY8n1zRkccN018UCRxmxPFNBBFBVDFVXnmoBWRIjkZDpvC/qcJYE\\n9Hz/W0d0JbBnOtz3lsL7AKAVxXYi/wr7BMixF4sLvVc109NDLdsb7EGPl1AgLqpj\\nGdyNgVwTcyUcR8uzLV005D18pbqfYYTGAAL2NXB1AoGAd3xPPwDK2WgHD7YD5z1M\\nt0iIZjtj8tCsGmJu3t0VjshfqIWrAF38iMWTjzZfg6vxkofvHDQNdxn3fCNaKTIw\\n70+e0f\\ndkAE0dl6B4grj8odxlA+rAs=\\n-----END PRIVATE KEY-----\\n",
  "client_email": "ai-telesuitefinal@pitchperfect-ai-s0jx8.iam.gserviceaccount.com",
  "client_id": "109156462036092362629",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ai-telesuitefinal%40pitchperfect-ai-s0jx8.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```
**Purpose:** A service account key for server-side Genkit authentication with Google Cloud services.

---

**File: `next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '150mb', // Increase body size limit to safely handle 100MB files after Base64 encoding
    },
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });

    if (!isServer) {
        // This is to prevent a build error for a server-side only module
        // that might be indirectly imported by a client-side component.
        config.resolve.alias['async_hooks'] = require.resolve('./lib/empty-module.ts');
    }

    return config;
  },
};

module.exports = nextConfig;
```
**Purpose:** Configures the Next.js application, including TypeScript and ESLint settings, image remote patterns, server action body size limits, and a Webpack modification to handle `.md` file imports as raw text.

---

**File: `n8n_workflow.json`**
```json
{
  "name": "AI_TeleSuite_Workflow",
  "nodes": [
    {
      "parameters": {},
      "id": "startNode",
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "typeVersion": 1,
      "position": [
        250,
        300
      ]
    }
  ],
  "connections": {},
  "active": false,
  "settings": {},
  "id": "ai-telesuite-workflow"
}
```
**Purpose:** A minimal, valid n8n workflow file. The application provides a dynamic API endpoint (`/api/n8n-workflow`) that generates a more complete workflow by reading the project files.

---

**File: `package.json`**
```json
{
  "name": "ai-telesuite-replication",
  "version": "0.1.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "NODE_ENV=production next start -p 9003",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^4.1.3",
    "@radix-ui/react-accordion": "^1.2.3",
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-menubar": "^1.1.6",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@tanstack/react-query": "^5.66.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.0",
    "date-fns": "^3.6.0",
    "docx-preview": "^0.3.2",
    "geist": "^1.3.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.475.0",
    "next": "15.2.3",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.54.2",
    "recharts": "^2.15.1",
    "tailwind-merge": "^3.0.1",
    "tailwindcss-animate": "^1.0.7",
    "xlsx": "^0.18.5",
    "zod": "^3.24.2",
    "genkit": "^1.0.0",
    "@genkit-ai/googleai": "^1.0.0",
    "@genkit-ai/next": "^1.0.0",
    "genkit-cli": "^1.0.0",
    "wav": "^1.0.2"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "postcss": "^8",
    "raw-loader": "^4.0.2",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```
**Purpose:** Defines project metadata, scripts, and all dependencies required for the application.

---

**File: `tailwind.config.ts`**
```typescript
import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```
**Purpose:** Configures Tailwind CSS, including theme colors, keyframes for animations, and plugins, ensuring a consistent design system based on the CSS variables in `globals.css`.

---

**File: `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
**Purpose:** The main TypeScript configuration file for the Next.js project, setting compiler options, module resolution strategies, and path aliases.

</details>

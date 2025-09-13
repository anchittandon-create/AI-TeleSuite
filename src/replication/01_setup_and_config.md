# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 1

## **Part 1: Core Setup & Configuration**

This document contains the full code for all root-level configuration files necessary to set up the project. This includes `package.json`, `tailwind.config.ts`, `next.config.js`, and all other essential configuration files.

---

### **1.1. Core Technology Stack & Configuration**

*   **Framework:** Next.js (v15.x or latest stable) using the App Router.
*   **Language:** TypeScript.
*   **UI Library:** React (v18.x) with ShadCN UI components.
*   **Styling:** Tailwind CSS.
*   **AI Backend & Orchestration:** Genkit (v1.x) using `@genkit-ai/googleai`.
*   **AI Models:** Google's Gemini models.
*   **Client-Side State Management:** React Hooks and `use-local-storage`.
*   **Text-to-Speech (TTS):** A client-side utility calling the Google Cloud TTS REST API.
*   **Speech-to-Text (ASR):** Browser's native `window.SpeechRecognition` API.

---

### **1.2. Root Directory Files: Full Code**

#### **File: `package.json`**
**Purpose:** Defines project metadata, scripts, and all dependencies.

```json
{
  "name": "ai-telesuite-replication",
  "version": "0.1.1",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "NODE_ENV=production next start -p 9003", "lint": "next lint", "typecheck": "tsc --noEmit" },
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

---

#### **File: `next.config.js`**
**Purpose:** Configures the Next.js application, including TypeScript/ESLint settings, image remote patterns, server action body size limits, and Webpack modifications.

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
        config.resolve.alias['async_hooks'] = require.resolve('../lib/empty-module.ts');
    }

    return config;
  },
};

module.exports = nextConfig;
```

---

#### **File: `tailwind.config.ts`**
**Purpose:** Standard Tailwind CSS configuration for a ShadCN project.

```typescript
import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
```

---

#### **File: `tsconfig.json`**
**Purpose:** TypeScript configuration for the Next.js project.

```json
{
  "compilerOptions": {
    "target": "es5",
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

---

#### **File: `postcss.config.mjs`**
**Purpose:** Standard PostCSS configuration for Tailwind CSS.

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

---

#### **File: `components.json`**
**Purpose:** Configuration file for the ShadCN UI library, defining component paths and styling options.

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

---

#### **File: `.env`**
**Purpose:** Stores environment variables. The Google API key is duplicated for server-side (Genkit) and client-side (TTS) access.

```
GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_and_tts_enabled
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_cloud_api_key_with_gemini_and_tts_enabled
```

---

#### **File: `key.json`**
**Purpose:** A service account key for server-side Genkit authentication with Google Cloud services. The user must provide their own full private key.

```json
{
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "your_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n... (your full private key content) ...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "your_client_email",
  "client_id": "your_client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your_client_x509_cert_url",
  "universe_domain": "googleapis.com"
}
```

---

#### **File: `n8n_workflow.json`**
**Purpose:** A minimal, valid n8n workflow file. The application provides an API endpoint that generates a more complete workflow dynamically.

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
      "position": [ 250, 300 ]
    }
  ],
  "connections": {},
  "active": false,
  "settings": {},
  "id": "ai-telesuite-workflow"
}
```

---

This concludes Part 1. All subsequent parts will detail the application's source code line by line.

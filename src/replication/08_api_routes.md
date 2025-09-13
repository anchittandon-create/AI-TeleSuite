# Replication Prompt: Part 8 - API Routes

This document provides the implementation for server-side API routes located in `/src/app/api/`.

---

### **1. Project Cloner API**

This API route is responsible for dynamically creating a ZIP archive of the entire project's source code for download.

#### **File: `src/app/api/clone-app/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';

// List of files and directories to include in the ZIP file.
const pathsToInclude = [
    './src',
    './public',
    './.env',
    './components.json',
    './key.json',
    './next.config.js',
    './package.json',
    './postcss.config.mjs',
    './tailwind.config.ts',
    './tsconfig.json',
    './README.md',
    './REPLICATION_PROMPT.md',
];

// List of files, directories, or extensions to exclude.
const exclusions = [
    'node_modules',
    '.next',
    '.DS_Store',
    '__pycache__',
    '.log',
    'pnpm-lock.yaml',
    'next-env.d.ts'
];

async function addFilesToZip(zip: JSZip, dirPath: string, basePath: string = '') {
    // ... (implementation for recursively adding files to zip)
}

export async function GET() {
  try {
    const zip = new JSZip();
    const projectRoot = process.cwd();

    for (const itemPath of pathsToInclude) {
        // ... (logic to read files/dirs and add to zip)
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(zipContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="AI_TeleSuite_Clone.zip"',
      },
    });

  } catch (error: any) {
    console.error("Error creating ZIP file:", error);
    return NextResponse.json({ error: `Failed to create project archive: ${error.message}` }, { status: 500 });
  }
}
```
**Purpose:** When a GET request is made to `/api/clone-app`, this route reads the specified project files, packages them into a ZIP archive using `JSZip`, and streams the archive back to the user for download.

---

### **2. n8n Workflow API**

This API route dynamically generates a valid n8n workflow file containing the project's source code.

#### **File: `src/app/api/n8n-workflow/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// ... (Interface definitions and path/exclusion constants)

async function addFilesToNodeList(nodes: N8nNode[], dirPath: string, basePath: string = '') {
    // ... (implementation for converting files to n8n 'Set' nodes)
}

export async function GET() {
    try {
        const projectRoot = process.cwd();
        const nodes: N8nNode[] = [
            // Start Node
        ];

        for (const itemPath of pathsToInclude) {
            // ... (logic to read files/dirs and convert them to n8n nodes)
        }

        const connections = // ... (logic to connect nodes)

        const n8nWorkflow = {
            // ... (full n8n JSON structure)
        };
        
        return NextResponse.json(n8nWorkflow, {
            status: 200,
            headers: {
                'Content-Disposition': 'attachment; filename="AI_TeleSuite_n8n_Workflow.json"',
                'Content-Type': 'application/json',
            },
        });

    } catch (error: any) {
        console.error("Error creating n8n workflow JSON:", error);
        return NextResponse.json({ error: `Failed to create n8n workflow: ${error.message}` }, { status: 500 });
    }
}
```
**Purpose:** When a GET request is made to `/api/n8n-workflow`, this route reads the project files and serializes their content into a valid n8n workflow JSON structure. This allows a user to import the entire project's source code into their n8n instance.
# 🔁 AI_TeleSuite: Full Replication Prompt (v1.1) - Part 8

## **Part 8: API Routes**

This document provides the implementation for server-side API routes used by the application.

---

### **8.1. Clone App API Route**

#### **File: `src/app/api/clone-app/route.ts`**
**Purpose:** This API route dynamically generates a ZIP archive of the entire project's source code, excluding `node_modules` and other specified folders/files. This allows the user to download a complete, runnable copy of the application.

```typescript
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';

// List of files and directories to include in the ZIP file.
const pathsToInclude = [
    './src',
    './public',
    './scripts',
    './.env',
    './.vscode',
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
    '.npmrc',
    'next-env.d.ts'
];

async function addFilesToZip(zip: JSZip, dirPath: string, basePath: string = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (exclusions.some(exclusion => entry.name.includes(exclusion))) {
            continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const zipPath = path.join(basePath, entry.name);

        if (entry.isDirectory()) {
            await addFilesToZip(zip, fullPath, zipPath);
        } else if (entry.isFile()) {
            try {
                const content = await fs.readFile(fullPath);
                zip.file(zipPath, content);
            } catch (readError) {
                console.warn(`Could not read file, skipping: ${fullPath}`, readError);
            }
        }
    }
}

export async function GET() {
  try {
    const zip = new JSZip();
    const projectRoot = process.cwd();

    for (const itemPath of pathsToInclude) {
      const fullPath = path.join(projectRoot, itemPath);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          await addFilesToZip(zip, fullPath, itemPath);
        } else if (stats.isFile()) {
          const content = await fs.readFile(fullPath);
          zip.file(itemPath, content);
        }
      } catch (statError) {
        console.warn(`Path not found, skipping: ${itemPath}`);
      }
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

---

### **8.2. n8n Workflow API Route**

#### **File: `src/app/api/n8n-workflow/route.ts`**
**Purpose:** This API route dynamically generates a JSON file formatted for import into n8n, a workflow automation tool. It reads the project structure and creates a series of "Set" nodes representing the files.

```typescript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface N8nNode {
    // ... (interface definition for an n8n node)
}

const pathsToInclude = [
    './src',
    './public',
    // ... (rest of paths to include)
];

const exclusions = [
    'node_modules',
    '.next',
    // ... (rest of exclusions)
];

async function addFilesToNodeList(nodes: N8nNode[], dirPath: string, basePath: string = '') {
    // ... (Recursive function to read files and create n8n nodes)
}

export async function GET() {
    try {
        const projectRoot = process.cwd();
        const nodes: N8nNode[] = [];
        
        // ... (Logic to build the array of n8n nodes and connections) ...

        const n8nWorkflow = {
            name: 'AI_TeleSuite Clone Workflow',
            nodes: nodes,
            connections: { /* ... */ },
            // ... (rest of n8n workflow structure)
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

---

This concludes the final part of the replication specification.

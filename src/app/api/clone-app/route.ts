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
    try {
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
    } catch (dirError) {
        console.warn(`Could not read directory, skipping: ${dirPath}`, dirError);
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

    const zipContent = await zip.generateAsync({ type: 'arraybuffer' });
    const zipBlob = new Blob([zipContent], { type: 'application/zip' });

    return new NextResponse(zipBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="AI_TeleSuite_Clone.zip"',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating ZIP file:", error);
    return NextResponse.json({ error: `Failed to create project archive: ${errorMessage}` }, { status: 500 });
  }
}

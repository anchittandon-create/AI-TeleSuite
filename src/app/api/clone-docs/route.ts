import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';

// List of documentation files and directories to include.
const pathsToInclude = [
    './src/replication',
    './REPLICATION_PROMPT.md'
];

async function addFilesToZip(zip: JSZip, dirPath: string, basePath: string = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        // Change file extension from .md to .doc for Word compatibility
        const zipPath = path.join(basePath, entry.name.endsWith('.md') ? entry.name.replace(/\.md$/, '.doc') : entry.name);

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
          // Change file extension for the root file as well
          const zipPath = itemPath.endsWith('.md') ? itemPath.replace(/\.md$/, '.doc') : itemPath;
          zip.file(zipPath, content);
        }
      } catch (statError) {
        console.warn(`Documentation path not found, skipping: ${itemPath}`);
      }
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    return new NextResponse(zipContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="AI_TeleSuite_Replication_Docs.zip"',
      },
    });

  } catch (error: any) {
    console.error("Error creating documentation ZIP file:", error);
    return NextResponse.json({ error: `Failed to create documentation archive: ${error.message}` }, { status: 500 });
  }
}

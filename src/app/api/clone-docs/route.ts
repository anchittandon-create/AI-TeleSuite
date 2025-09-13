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
        // Modified to place all files at the root of the zip.
        const zipFileName = entry.name.endsWith('.md') ? entry.name.replace(/\.md$/, '.doc') : entry.name;

        if (entry.isDirectory()) {
            // Recurse without adding the directory path to the zip path
            await addFilesToZip(zip, fullPath, ''); 
        } else if (entry.isFile()) {
            try {
                const content = await fs.readFile(fullPath);
                zip.file(zipFileName, content);
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
          // Pass an empty string for basePath to flatten the structure.
          await addFilesToZip(zip, fullPath, '');
        } else if (stats.isFile()) {
          const content = await fs.readFile(fullPath);
          // Change file extension for the root file and add it to the root of the zip.
          const zipFileName = itemPath.endsWith('.md') ? path.basename(itemPath).replace(/\.md$/, '.doc') : path.basename(itemPath);
          zip.file(zipFileName, content);
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

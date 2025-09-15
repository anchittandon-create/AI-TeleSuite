import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// List of documentation files and directories to include.
const pathsToInclude = [
    './REPLICATION_PROMPT.md',
    './src/replication',
];

async function getFileContent(filePath: string): Promise<{ path: string; content: string } | null> {
    try {
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        return { path: filePath, content };
    } catch (readError) {
        console.warn(`Could not read file, skipping: ${filePath}`, readError);
        return null;
    }
}

async function getFilesInDir(dirPath: string): Promise<{ path: string; content: string }[]> {
    const collectedFiles: { path: string; content: string }[] = [];
    try {
        const fullPath = path.join(process.cwd(), dirPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryItemPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                collectedFiles.push(...await getFilesInDir(entryItemPath));
            } else if (entry.isFile()) {
                const fileData = await getFileContent(entryItemPath);
                if (fileData) {
                    collectedFiles.push(fileData);
                }
            }
        }
    } catch (dirError) {
        console.warn(`Could not read directory, skipping: ${dirPath}`, dirError);
    }
    return collectedFiles;
}


export async function GET() {
  try {
    const allFiles: { path: string; content: string }[] = [];

    for (const itemPath of pathsToInclude) {
        const fullPath = path.join(process.cwd(), itemPath);
            try {
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
                allFiles.push(...await getFilesInDir(itemPath));
            } else if (stats.isFile()) {
                const fileData = await getFileContent(itemPath);
                if (fileData) {
                    allFiles.push(fileData);
                }
            }
        } catch (statError) {
            console.warn(`Documentation path not found, skipping: ${itemPath}`);
        }
    }

    // Sort files based on the numeric prefix in their filename (01_, 02_, etc.)
    allFiles.sort((a, b) => {
        const aName = a.path.split('/').pop() || '';
        const bName = b.path.split('/').pop() || '';
        return aName.localeCompare(bName, undefined, { numeric: true });
    });

    let masterContent = "--- START OF AI_TELESUITE MASTER REPLICATION PROMPT ---\n\n";
    masterContent += "INSTRUCTIONS: This single document contains the complete, multi-part specification for replicating the AI_TeleSuite application. Process the entire content of this file sequentially to ensure a 100% accurate clone.\n\n";
    masterContent += "========================================================\n\n";
    
    for (const file of allFiles) {
        const fileName = file.path.split('/').pop();
        masterContent += `\n\n--- BEGIN FILE: ${fileName} ---\n\n`;
        masterContent += file.content;
        masterContent += `\n\n--- END FILE: ${fileName} ---\n\n`;
        masterContent += "========================================================\n";
    }
    masterContent += "\n--- END OF AI_TELESUITE MASTER REPLICATION PROMPT ---";

    return new NextResponse(masterContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="AI_TeleSuite_Master_Replication_Prompt.txt"',
      },
    });

  } catch (error: any) {
    console.error("Error creating master prompt file:", error);
    return NextResponse.json({ error: `Failed to create master prompt file: ${error.message}` }, { status: 500 });
  }
}

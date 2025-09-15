import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// List of documentation files and directories to include.
const pathsToInclude = [
    './src/replication',
    './REPLICATION_PROMPT.md'
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
            } else if (entry.isFile() && entry.name.endsWith('.md')) { // Ensure we only read markdown files
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
                } else if (stats.isFile() && itemPath.endsWith('.md')) {
                    const fileData = await getFileContent(itemPath);
                    if (fileData) {
                        allFiles.push(fileData);
                    }
                }
            } catch (statError) {
                console.warn(`Documentation path not found, skipping: ${itemPath}`);
            }
        }
        
        return NextResponse.json(allFiles, { status: 200 });

    } catch (error: any) {
        console.error("Error creating documentation file list:", error);
        return NextResponse.json({ error: `Failed to create documentation file list: ${error.message}` }, { status: 500 });
    }
}

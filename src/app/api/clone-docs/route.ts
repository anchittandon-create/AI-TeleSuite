import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// This API route now only needs to serve the single, master replication prompt.
const MASTER_PROMPT_PATH = './REPLICATION_PROMPT.md';

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


export async function GET() {
    try {
        const masterPromptFile = await getFileContent(MASTER_PROMPT_PATH);
        
        if (!masterPromptFile) {
            throw new Error(`Master prompt file not found at ${MASTER_PROMPT_PATH}`);
        }
        
        // Return the single master prompt file in the expected array format for the frontend.
        return NextResponse.json([masterPromptFile], { status: 200 });

    } catch (error: any) {
        console.error("Error fetching master replication prompt:", error);
        return NextResponse.json({ error: `Failed to fetch master replication prompt: ${error.message}` }, { status: 500 });
    }
}

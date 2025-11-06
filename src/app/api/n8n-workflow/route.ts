import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the structure of an n8n node for clarity
interface N8nNode {
    parameters: {
        values?: {
            string: Array<{ name: string; value: string }>;
        };
        options?: {};
    };
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
}

// List of files and directories to include in the workflow.
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

const exclusions = [
    'node_modules',
    '.next',
    '__pycache__',
    '.DS_Store',
    'pnpm-lock.yaml',
    '.npmrc',
    'next-env.d.ts'
];

async function addFilesToNodeList(nodes: N8nNode[], dirPath: string, basePath: string = '') {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (exclusions.some(exclusion => entry.name.includes(exclusion))) {
                continue;
            }

            const fullPath = path.join(dirPath, entry.name);
            const zipPath = path.join(basePath, entry.name);

            if (entry.isDirectory()) {
                await addFilesToNodeList(nodes, fullPath, zipPath);
            } else if (entry.isFile()) {
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    nodes.push({
                        parameters: {
                            values: {
                                string: [
                                    { name: 'filePath', value: zipPath },
                                    { name: 'fileContent', value: content }
                                ]
                            },
                            options: {}
                        },
                        id: `fileNode-${nodes.length}`,
                        name: `Set: ${zipPath}`,
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [250, 50 + nodes.length * 100]
                    });
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
        const projectRoot = process.cwd();
        const nodes: N8nNode[] = [];
        
        // Start Node
        nodes.push({
            parameters: {},
            id: 'startNode',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            typeVersion: 1,
            position: [50, 50]
        });

        for (const itemPath of pathsToInclude) {
            const fullPath = path.join(projectRoot, itemPath);
            try {
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory()) {
                    await addFilesToNodeList(nodes, fullPath, itemPath);
                } else if (stats.isFile()) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                     nodes.push({
                        parameters: {
                            values: {
                                string: [
                                    { name: 'filePath', value: itemPath },
                                    { name: 'fileContent', value: content }
                                ]
                            },
                            options: {}
                        },
                        id: `fileNode-${nodes.length}`,
                        name: `Set: ${itemPath}`,
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [250, 50 + nodes.length * 100]
                    });
                }
            } catch (statError) {
                console.warn(`Path not found, skipping: ${itemPath}`);
            }
        }

        const connections = nodes.slice(0, -1).map((node, index) => {
            const nextNode = nodes[index + 1];
            return {
                source: node.id,
                target: nextNode.id,
                type: 'standard'
            };
        });

        const n8nWorkflow = {
            name: 'AI_TeleSuite Clone Workflow',
            nodes: nodes,
            connections: {
                main: connections,
            },
            active: false,
            settings: {},
            id: 'clone-workflow-1',
            meta: {
                instanceId: "auto-generated-instance-id"
            },
            tags: []
        };
        
        // This time, we let NextResponse handle the JSON stringification,
        // which guarantees it will be valid.
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

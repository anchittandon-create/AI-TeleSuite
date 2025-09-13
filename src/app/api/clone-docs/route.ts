import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs/promises';
import jsPDF from 'jspdf';

// List of documentation files and directories to include.
const pathsToInclude = [
    './src/replication',
    './REPLICATION_PROMPT.md'
];

async function addFilesToZip(zip: JSZip, dirPath: string, basePath: string = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const zipPath = path.join(basePath, entry.name);

        if (entry.isDirectory()) {
            await addFilesToZip(zip, fullPath, zipPath);
        } else if (entry.isFile()) {
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                zip.file(zipPath, content);
            } catch (readError) {
                console.warn(`Could not read file, skipping: ${fullPath}`, readError);
            }
        }
    }
}


const generatePdfFromText = (textContent: string): Buffer => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    const maxLineWidth = pageWidth - margin * 2;
    const lineHeight = 12;

    const lines = pdf.splitTextToSize(textContent, maxLineWidth);
    
    let cursorY = margin;
    lines.forEach((line: string) => {
        if (cursorY + lineHeight > pageHeight - margin) {
            pdf.addPage();
            cursorY = margin;
        }
        pdf.text(line, margin, cursorY);
        cursorY += lineHeight;
    });
    
    return Buffer.from(pdf.output('arraybuffer'));
};


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'doc'; // Default to .doc

    try {
        const zip = new JSZip();
        const projectRoot = process.cwd();

        for (const itemPath of pathsToInclude) {
            const fullPath = path.join(projectRoot, itemPath);
            try {
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory()) {
                    const dirEntries = await fs.readdir(fullPath, { withFileTypes: true });
                    for (const entry of dirEntries) {
                        if (entry.isFile() && entry.name.endsWith('.md')) {
                            const content = await fs.readFile(path.join(fullPath, entry.name), 'utf-8');
                            const baseName = entry.name.replace(/\.md$/, '');
                            
                            if (format === 'pdf') {
                                zip.file(`${baseName}.pdf`, generatePdfFromText(content));
                            } else {
                                zip.file(`${baseName}.${format}`, content);
                            }
                        }
                    }
                } else if (stats.isFile() && itemPath.endsWith('.md')) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const baseName = path.basename(itemPath, '.md');
                     if (format === 'pdf') {
                        zip.file(`${baseName}.pdf`, generatePdfFromText(content));
                    } else {
                        zip.file(`${baseName}.${format}`, content);
                    }
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
                'Content-Disposition': `attachment; filename="AI_TeleSuite_Replication_Docs_${format.toUpperCase()}.zip"`,
            },
        });

    } catch (error: any) {
        console.error("Error creating documentation ZIP file:", error);
        return NextResponse.json({ error: `Failed to create documentation archive: ${error.message}` }, { status: 500 });
    }
}

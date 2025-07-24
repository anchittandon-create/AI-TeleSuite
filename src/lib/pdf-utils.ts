
"use client";

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { format, parseISO } from 'date-fns';

// Augment jsPDF with autoTable plugin
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

/**
 * Generates a PDF from plain text content and returns it as a Blob.
 * @param textContent The string content to write to the PDF.
 * @returns A Blob representing the generated PDF file.
 */
function generateTextPdfBlob(textContent: string): Blob {
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
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

    return pdf.output('blob');
}


/**
 * Exports plain text content to a PDF file by triggering a download.
 * @param textContent The string content to write to the PDF.
 * @param filename The desired name for the downloaded PDF file.
 */
export function exportTextContentToPdf(textContent: string, filename: string): void {
  try {
    const blob = generateTextPdfBlob(textContent);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating text-based PDF:", error);
    alert("Failed to generate PDF. Your browser might not be fully supported or there was an unexpected error.");
  }
}


/**
 * Generates a structured Call Scoring report PDF and returns it as a Blob.
 * @param item The HistoricalScoreItem containing all the report data.
 * @returns A Blob representing the generated PDF file.
 */
function generateCallScoreReportPdfBlob(item: HistoricalScoreItem): Blob {
    const { scoreOutput, fileName, agentName, product, timestamp } = item;
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;
    
    // --- Header ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text("Call Scoring Report", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 25;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`File Name: ${fileName}`, margin, cursorY);
    cursorY += 15;
    pdf.text(`Agent Name: ${agentName || 'N/A'}`, margin, cursorY);
    pdf.text(`Date Scored: ${format(parseISO(timestamp), 'PP p')}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 15;
    pdf.text(`Product Focus: ${product || 'General'}`, margin, cursorY);
    pdf.text(`Overall Score: ${scoreOutput.overallScore.toFixed(1)}/5 (${scoreOutput.callCategorisation})`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 20;

    // --- Helper function for sections ---
    const addSection = (title: string, content: string | string[]) => {
      if (cursorY + 30 > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, margin, cursorY);
      cursorY += 18;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      const contentLines = pdf.splitTextToSize(Array.isArray(content) ? content.map(s => `- ${s}`).join('\n') : content, contentWidth);
      contentLines.forEach((line: string) => {
        if (cursorY > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.text(line, margin, cursorY);
        cursorY += 12;
      });
      cursorY += 10;
    };

    // --- Sections ---
    addSection("Summary", scoreOutput.summary);
    if(scoreOutput.strengths?.length > 0) addSection("Key Strengths", scoreOutput.strengths);
    if(scoreOutput.areasForImprovement?.length > 0) addSection("Areas for Improvement", scoreOutput.areasForImprovement);

    // --- Metrics Table ---
     if (cursorY + 40 > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        cursorY = margin;
      }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text("Detailed Metric Scores", margin, cursorY);
    cursorY += 5;

    if (scoreOutput.metricScores && scoreOutput.metricScores.length > 0) {
      const tableHead = [['Metric', 'Score', 'Feedback']];
      const tableBody = scoreOutput.metricScores.map(m => [
        m.metric,
        `${m.score}/5`,
        m.feedback || 'N/A'
      ]);
      
      pdf.autoTable({
        head: tableHead,
        body: tableBody,
        startY: cursorY,
        headStyles: { fillColor: [41, 171, 226], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 'auto' },
        },
        didDrawPage: (data) => {
            cursorY = data.cursor?.y || cursorY;
        }
      });
      cursorY = pdf.autoTable.previous.finalY + 20;
    } else {
       pdf.setFont('helvetica', 'normal');
       pdf.setFontSize(10);
       pdf.text("No detailed metric scores were provided.", margin, cursorY);
       cursorY += 22;
    }

    // --- Transcript ---
    addSection("Full Transcript", scoreOutput.transcript);

    return pdf.output('blob');
}

/**
 * Exports a structured Call Scoring report to a well-formatted PDF file.
 * @param item The HistoricalScoreItem containing all the report data.
 * @param filename The desired name for the downloaded PDF file.
 */
export function exportCallScoreReportToPdf(item: HistoricalScoreItem, filename: string): void {
  try {
    const blob = generateCallScoreReportPdfBlob(item);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating structured PDF for Call Score Report:", error);
    alert("Failed to generate PDF report. Check console for details.");
  }
}

export { generateTextPdfBlob, generateCallScoreReportPdfBlob };

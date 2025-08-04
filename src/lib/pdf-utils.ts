
"use client";

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { HistoricalScoreItem } from '@/app/(main)/call-scoring-dashboard/page';
import { format, parseISO } from 'date-fns';
import { CallScoreCategory } from '@/types';

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
export function generateTextPdfBlob(textContent: string): Blob {
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - margin * 2;
    // Use a smaller line height for better density
    const lineHeight = 10;

    const lines = pdf.splitTextToSize(textContent, maxLineWidth);
    
    let cursorY = margin;

    lines.forEach((line: string) => {
      if (cursorY + lineHeight > pageHeight - margin) { 
        pdf.addPage();
        cursorY = margin; 
      }
      pdf.text(line, margin, cursorY);
      cursorY += 12; // Increased line height for better readability
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


const getPerformanceStringFromScore = (score: number): string => {
  if (score <= 1.5) return "Poor";
  if (score <= 2.5) return "Needs Improvement";
  if (score <= 3.5) return "Average";
  if (score <= 4.5) return "Good";
  return "Excellent";
};


/**
 * Generates a structured Call Scoring report PDF and returns it as a Blob.
 * @param item The HistoricalScoreItem containing all the report data.
 * @returns A Blob representing the generated PDF file.
 */
export function generateCallScoreReportPdfBlob(item: HistoricalScoreItem): Blob {
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
    pdf.setFontSize(18);
    pdf.text("Call Scoring Report", pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 30;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const metadataLeft = [
      `File Name: ${fileName}`,
      `Agent Name: ${agentName || 'N/A'}`,
      `Product Focus: ${product || 'General'}`
    ];
    const metadataRight = [
      `Date Scored: ${format(parseISO(timestamp), 'PP p')}`,
      `Overall Score: ${scoreOutput.overallScore.toFixed(1)}/5 (${getPerformanceStringFromScore(scoreOutput.overallScore)})`
    ];

    pdf.text(metadataLeft, margin, cursorY);
    pdf.text(metadataRight, pageWidth - margin, cursorY, { align: 'right' });
    
    cursorY += (metadataLeft.length * 12) + 15;
    pdf.setDrawColor(200);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 20;


    // --- Helper function for sections ---
    const addSection = (title: string, content: string | string[], isList: boolean = false) => {
      const neededHeight = (Array.isArray(content) ? content.length : 1) * 12 + 30;
      if (cursorY + neededHeight > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(title, margin, cursorY);
      cursorY += 18;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      const contentToProcess = isList && Array.isArray(content) 
        ? content.map(s => `- ${s}`).join('\n') 
        : Array.isArray(content) ? content.join('\n') : content;
      
      const contentLines = pdf.splitTextToSize(contentToProcess, contentWidth);

      contentLines.forEach((line: string) => {
        if (cursorY + 12 > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.text(line, margin + (isList ? 5 : 0), cursorY);
        cursorY += 12;
      });
      cursorY += 15;
    };

    // --- Report Body ---
    addSection("Summary", scoreOutput.summary);
    if(scoreOutput.strengths?.length > 0) addSection("Key Strengths", scoreOutput.strengths, true);
    if(scoreOutput.areasForImprovement?.length > 0) addSection("Areas for Improvement", scoreOutput.areasForImprovement, true);

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
    
    // --- Full Transcript ---
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


"use client";

import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import type { HistoricalScoreItem, ScoreCallOutput } from '@/types';
import { format, parseISO } from 'date-fns';

// Augment jsPDF with autoTable plugin
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

/**
 * Generates a PDF from plain text content and returns it as a Blob.
 * @param textContent The string content to write to the PDF.
 * @returns A Blob representing the generated PDF file.
 */
export function generateTextPdfBlob(textContent: string, title?: string): Blob {
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    const maxLineWidth = pageWidth - margin * 2;
    const lineHeight = 12; 

    let cursorY = margin;
    
    if (title) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(title, maxLineWidth);
        pdf.text(titleLines, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += (titleLines.length * 16) + 20;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
    }

    const lines = pdf.splitTextToSize(textContent, maxLineWidth);
    
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
 * @param returnBlob Whether to return the blob instead of downloading.
 */
export function exportTextContentToPdf(textContent: string, filename: string, returnBlob: boolean = false): Blob | void {
  try {
    const title = filename.replace(/\.pdf$/, '').replace(/_/g, ' ');
    const blob = generateTextPdfBlob(textContent, title);
    if(returnBlob) {
        return blob;
    }
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
  if (score >= 4.5) return "Excellent";
  if (score >= 3.5) return "Good";
  if (score >= 2.5) return "Average";
  if (score >= 1.5) return "Needs Improvement";
  return "Unsatisfactory";
};


/**
 * Generates a structured Call Scoring report PDF and returns it as a Blob.
 * @param item The HistoricalScoreItem containing all the report data.
 * @returns A Blob representing the generated PDF file.
 */
export async function generateCallScoreReportPdfBlob(item: HistoricalScoreItem): Promise<Blob> {
    const { scoreOutput, fileName, agentNameFromForm: agentName } = item.details;
    const { product, timestamp } = item;

    if (!scoreOutput || typeof scoreOutput.overallScore !== 'number') {
      throw new Error("Cannot generate PDF report: The scoring data is incomplete or missing.");
    }
    
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    
    const margin = 40;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const addPageIfNeeded = (neededHeight: number = 20) => {
        if (cursorY + neededHeight > pageHeight - margin) {
            pdf.addPage();
            cursorY = margin;
        }
    };
    
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
      `Overall Score: ${scoreOutput.overallScore.toFixed(1)}/5 (${scoreOutput.callCategorisation})`,
      `Conversion Readiness: ${scoreOutput.conversionReadiness || 'N/A'}`,
      `Suggested Disposition: ${scoreOutput.suggestedDisposition || 'N/A'}`
    ];

    pdf.text(metadataLeft, margin, cursorY);
    pdf.text(metadataRight, pageWidth - margin, cursorY, { align: 'right' });
    
    cursorY += (metadataRight.length * 12) + 15;
    pdf.setDrawColor(200);
    pdf.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 20;


    // --- Helper function for sections ---
    const addSection = (title: string, content: string | string[], options: { isList?: boolean, fontStyle?: 'normal' | 'bold' | 'italic', titleColor?: [number, number, number] } = {}) => {
      addPageIfNeeded(30);
      pdf.setFont('helvetica', options.fontStyle || 'bold');
      pdf.setFontSize(12);
      if (options.titleColor) {
        pdf.setTextColor(options.titleColor[0], options.titleColor[1], options.titleColor[2]);
      }
      pdf.text(title, margin, cursorY);
      cursorY += 18;
      pdf.setTextColor(0, 0, 0); // Reset color
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      const contentToProcess = options.isList && Array.isArray(content) 
        ? content.map(s => `- ${s}`).join('\n') 
        : Array.isArray(content) ? content.join('\n') : content;
      
      const contentLines = pdf.splitTextToSize(contentToProcess, contentWidth);

      contentLines.forEach((line: string) => {
        addPageIfNeeded(12);
        pdf.text(line, margin + (options.isList ? 5 : 0), cursorY);
        cursorY += 12;
      });
      cursorY += 15;
    };
    
    // TAB 1: Summary & Coaching
    addSection("Summary", scoreOutput.summary);
    if(scoreOutput.strengths?.length > 0) addSection("Key Strengths", scoreOutput.strengths, { isList: true });
    if(scoreOutput.areasForImprovement?.length > 0) addSection("Areas for Improvement", scoreOutput.areasForImprovement, { isList: true });
    if(scoreOutput.redFlags && scoreOutput.redFlags.length > 0) {
        addSection("Critical Red Flags", scoreOutput.redFlags, { isList: true, titleColor: [220, 53, 69] });
    }

    // TAB 2: Detailed Metrics
    addPageIfNeeded(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text("Detailed Metric Scores", margin, cursorY);
    cursorY += 5;

    if (scoreOutput.metricScores && scoreOutput.metricScores.length > 0) {
      const tableHead = [['Metric', 'Score', 'Feedback']];
      const tableBody = scoreOutput.metricScores.map(m => [
        m.metric,
        `${m.score?.toFixed(1) || 'N/A'}/5`,
        m.feedback || 'N/A'
      ]);
      
      autoTable(pdf, {
        head: tableHead,
        body: tableBody,
        startY: cursorY,
        headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 'auto' },
        },
        didDrawPage: (data) => {
            cursorY = data.cursor?.y || cursorY;
        }
      });
      cursorY = (pdf.lastAutoTable?.finalY ?? cursorY) + 20;
    }
    
    // TAB 3: Situations
    if(scoreOutput.improvementSituations && scoreOutput.improvementSituations.length > 0) {
        addPageIfNeeded(30);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text("Situations for Improvement", margin, cursorY);
        cursorY += 18;
        
        scoreOutput.improvementSituations.forEach((sit, index) => {
            addPageIfNeeded(60); // Reserve space for a full situation block
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Situation ${index + 1}: ${sit.context}`, margin, cursorY);
            cursorY += 12;

            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(150, 150, 150);
            if(sit.timeInCall) {
                pdf.text(`Time in call: ${sit.timeInCall}`, margin, cursorY);
                cursorY += 12;
            }
            pdf.setTextColor(0, 0, 0);

            const formatSituationLine = (label: string, text: string) => {
                 const lines = pdf.splitTextToSize(`${label}: ${text}`, contentWidth - 10);
                 lines.forEach((line: string) => {
                    addPageIfNeeded(12);
                    pdf.text(line, margin + 10, cursorY);
                    cursorY += 12;
                 });
            };

            pdf.setFont('helvetica', 'normal');
            if(sit.userDialogue) formatSituationLine("User Said", `"${sit.userDialogue}"`);
            formatSituationLine("Agent's Response", `"${sit.agentResponse}"`);
            formatSituationLine("Suggested Response", `"${sit.suggestedResponse}"`);
            cursorY += 10;
        });
    }

    // TAB 4: Full Transcript
    addSection("Original Call Transcript", scoreOutput.transcript);

    return pdf.output('blob');
}

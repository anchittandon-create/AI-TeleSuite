
"use client";

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports the content of a given HTML element to a PDF file using html2canvas.
 * Note: Complex layouts or external resources might not render perfectly.
 * Consider using exportTextContentToPdf for more reliable text-based PDF generation.
 * @param elementId The ID of the HTML element to export.
 * @param filename The desired name for the downloaded PDF file.
 */
export async function exportElementToPdf(elementId: string, filename: string): Promise<void> {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    throw new Error(`Element with id ${elementId} not found.`);
  }

  try {
    const canvas = await html2canvas(input, { 
      scale: 2, 
      useCORS: true,
      logging: false,
      // Ensure the canvas captures the full scrollable content if possible,
      // though this can be tricky with html2canvas and nested scroll areas.
      // For true full content capture of scrollable elements, specific styling or
      // temporarily altering element styles might be needed.
      height: input.scrollHeight,
      windowHeight: input.scrollHeight
    });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt', 
      format: [canvas.width, canvas.height] 
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);

  } catch (error) {
    console.error("Error generating PDF from element:", error);
    throw error; // Re-throw for the caller to handle
  }
}

/**
 * Exports plain text content to a PDF file.
 * @param textContent The string content to write to the PDF.
 * @param filename The desired name for the downloaded PDF file.
 */
export function exportTextContentToPdf(textContent: string, filename: string): void {
  try {
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10); // Reduced font size for more content per page

    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20; // 20 points margin
    const maxLineWidth = pageWidth - margin * 2;
    const lineHeight = 12; // Reduced line height

    // Split text into lines that fit page width
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

    pdf.save(filename);
  } catch (error) {
    console.error("Error generating text-based PDF:", error);
    alert("Failed to generate PDF. Your browser might not be fully supported or there was an unexpected error.");
  }
}

"use client";

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function exportElementToPdf(elementId: string, filename: string): Promise<void> {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(input, { 
      scale: 2, // Improve quality
      useCORS: true, // If images are from other domains
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt', // points, matches html2canvas
      format: [canvas.width, canvas.height] // use canvas dimensions for PDF page size
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);

  } catch (error) {
    console.error("Error generating PDF:", error);
    // Fallback to text export if canvas fails for some reason
    exportTextContentToPdf(input.innerText, filename);
  }
}

export function exportTextContentToPdf(textContent: string, filename: string): void {
  try {
    const pdf = new jsPDF();
    // Set font, size
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);

    // Split text into lines that fit page width
    const lines = pdf.splitTextToSize(textContent, pdf.internal.pageSize.getWidth() - 40); // 20 margin each side
    
    let cursorY = 20;
    const lineHeight = 15; // Approximate line height

    lines.forEach((line: string, index: number) => {
      if (cursorY + lineHeight > pdf.internal.pageSize.getHeight() - 20) { // 20 margin bottom
        pdf.addPage();
        cursorY = 20; // Reset Y for new page
      }
      pdf.text(line, 20, cursorY);
      cursorY += lineHeight;
    });

    pdf.save(filename);
  } catch (error) {
    console.error("Error generating text-based PDF:", error);
    alert("Failed to generate PDF. Your browser might not be fully supported or there was an unexpected error.");
  }
}



export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) {
    return;
  }
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows.map(row => {
      return keys.map(k => {
        let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
        cell = cell instanceof Date
          ? cell.toLocaleString()
          : cell.toString().replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(separator);
    }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Exports text content to a file with the given filename (including extension).
 * @param filenameWithExtension The full desired filename, e.g., "report.doc" or "notes.txt".
 * @param textContent The string content to write to the file.
 */
export function exportToTxt(filenameWithExtension: string, textContent: string) {
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filenameWithExtension); // Use the filename as passed
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Helper to convert data URI to blob
function dataURItoBlob(dataURI: string): Blob | null {
  if (!dataURI || !dataURI.includes(',')) return null;
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (error) {
    console.error("Error converting data URI to Blob:", error);
    return null;
  }
}

export function downloadDataUriFile(dataUri: string, filename: string) {
  if (!dataUri) {
    console.error("Data URI is empty, cannot download.");
    return;
  }
  const blob = dataURItoBlob(dataUri);
  if (!blob) {
    console.error("Failed to convert Data URI to Blob for download.");
    return;
  }
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Important for memory management
  }
}

// --- New Export Functions for Table Data ---

function formatTableDataAsText(headers: string[], data: any[][], columnWidths?: number[]): string {
  let output = "";
  const colWidths = columnWidths || headers.map(h => h.length);

  data.forEach(row => {
    row.forEach((cell, colIndex) => {
      const cellStr = String(cell === null || cell === undefined ? "" : cell);
      if (colIndex < headers.length && cellStr.length > colWidths[colIndex]) {
        colWidths[colIndex] = cellStr.length;
      }
    });
  });
  
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ");
  output += headerLine + "\n";
  output += headers.map((_, i) => "-".repeat(colWidths[i])).join("-+-") + "\n";

  data.forEach(row => {
    const rowLine = row.map((cell, i) => {
      const cellStr = String(cell === null || cell === undefined ? "" : cell);
      return cellStr.padEnd(colWidths[i]);
    }).join(" | ");
    output += rowLine + "\n";
  });
  return output;
}

export function exportTableDataToTxt(filename: string, headers: string[], data: any[][]) {
  const textContent = formatTableDataAsText(headers, data);
  exportToTxt(filename, textContent);
}

export function exportTableDataToPdf(filename: string, headers: string[], data: any[][]) {
  const { jsPDF } = require("jspdf"); // Dynamic import for client-side only
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const lineHeight = 10;
  let cursorY = margin;

  // Simplified column width calculation (average or fixed)
  const numCols = headers.length;
  const colWidth = (pageWidth - 2 * margin) / numCols;
  
  const addPageIfNeeded = () => {
    if (cursorY + lineHeight > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
      // Re-draw headers on new page
      headers.forEach((header, colIndex) => {
        pdf.text(String(header), margin + colIndex * colWidth, cursorY);
      });
      cursorY += lineHeight * 1.5; // Extra space after header
    }
  };
  
  // Headers
  headers.forEach((header, colIndex) => {
      pdf.text(String(header), margin + colIndex * colWidth, cursorY);
  });
  cursorY += lineHeight * 0.5; // Space for separator
  pdf.line(margin, cursorY, pageWidth - margin, cursorY); // Separator line
  cursorY += lineHeight;


  // Data rows
  data.forEach(row => {
    addPageIfNeeded();
    row.forEach((cell, colIndex) => {
      const cellText = String(cell === null || cell === undefined ? "" : cell);
      // Wrap text within column width (very basic wrapping)
      const textLines = pdf.splitTextToSize(cellText, colWidth - 2); // Small padding
      textLines.forEach((line: string, lineIndex: number) => {
        if (lineIndex > 0) {
          addPageIfNeeded(); // Check for new page for multi-line cells
        }
        pdf.text(line, margin + colIndex * colWidth, cursorY + (lineIndex * (lineHeight * 0.8) ));
      });
    });
    cursorY += Math.max(1, pdf.splitTextToSize(String(row[0] || ''), colWidth-2).length) * (lineHeight * 0.8) + 2; // Adjust cursor based on max lines in first cell + padding
  });

  pdf.save(filename);
}
    

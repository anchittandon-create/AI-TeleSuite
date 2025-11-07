import type { UnknownRecord } from '@/types/common';

type TableCell = string | number | boolean | null | undefined;
type TableDataRow = TableCell[];

export function exportToCsv(filename: string, rows: UnknownRecord[]) {
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
        const value = row[k];
        let cell =
          value === null || value === undefined
            ? ''
            : value instanceof Date
              ? value.toLocaleString()
              : String(value).replace(/"/g, '""');
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
 * Exports plain text content to a file with the given filename (including extension).
 * Used for .txt, or .doc (as plain text outline).
 * @param filenameWithExtension The full desired filename, e.g., "report.doc" or "notes.txt".
 * @param textContent The string content to write to the file.
 */
export function exportPlainTextFile(filenameWithExtension: string, textContent: string) {
  const mimeType = filenameWithExtension.endsWith('.doc') ? 'application/msword' : 'text/plain;charset=utf-8;';
  const blob = new Blob([textContent], { type: mimeType });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filenameWithExtension);
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

export async function downloadDataUriFile(dataUri: string, filename: string) {
  if (!dataUri) {
    console.error("No audio reference provided, cannot download.");
    return;
  }

  let blob: Blob | null = null;

  if (dataUri.startsWith("data:")) {
    blob = dataURItoBlob(dataUri);
    if (!blob) {
      console.error("Failed to convert Data URI to Blob for download.");
      return;
    }
  } else {
    try {
      const response = await fetch(dataUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio asset (${response.status})`);
      }
      blob = await response.blob();
    } catch (error) {
      console.error("Unable to download remote audio asset:", error);
      return;
    }
  }

  const link = document.createElement('a');
  if (link.download !== undefined && blob) {
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


function formatTableDataAsText(headers: string[], data: TableDataRow[], _columnWidths?: number[]): string {
  let output = "";
  // Determine column widths based on headers and data
  const colWidths = headers.map((header, index) => {
    let maxWidth = header.length;
    data.forEach(row => {
      const cellStr = String(row[index] === null || row[index] === undefined ? "" : row[index]);
      if (cellStr.length > maxWidth) {
        maxWidth = cellStr.length;
      }
    });
    return maxWidth;
  });

  // Header row
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ");
  output += headerLine + "\n";
  // Separator line
  output += headers.map((_, i) => "-".repeat(colWidths[i])).join("-+-") + "\n";

  // Data rows
  data.forEach(row => {
    const rowLine = row.map((cell, i) => {
      const cellStr = String(cell === null || cell === undefined ? "" : cell);
      return cellStr.padEnd(colWidths[i]);
    }).join(" | ");
    output += rowLine + "\n";
  });
  return output;
}

export function exportTableDataForDoc(filename: string, headers: string[], data: TableDataRow[]) {
  const textContent = formatTableDataAsText(headers, data);
  exportPlainTextFile(filename.endsWith('.doc') ? filename : `${filename}.doc`, textContent);
}

export async function exportTableDataToPdf(filename: string, headers: string[], data: TableDataRow[]) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const pdf = new jsPDF({ orientation: 'landscape' });
  
  autoTable(pdf, {
      head: [headers],
      body: data,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { top: 20 },
      didDrawPage: function (data) {
          pdf.setFontSize(16);
          pdf.text("Exported Table Data", data.settings.margin.left, 15);
      },
  });

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

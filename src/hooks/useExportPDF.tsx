import { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportPDFOptions {
  filename?: string;
  title?: string;
}

export function useExportPDF() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = useCallback(async (elementId: string, options: ExportPDFOptions = {}) => {
    const { filename = "relatorio", title = "Relatório de Vendas e Assinaturas" } = options;
    
    setIsExporting(true);
    
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with id "${elementId}" not found`);
      }

      // Capture the element as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: imgHeight > pageHeight ? "portrait" : "portrait",
        unit: "mm",
        format: "a4",
      });

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(33, 33, 33);
      pdf.text(title, 14, 15);
      
      // Add date
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      const today = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      pdf.text(`Gerado em: ${today}`, 14, 22);

      // Add image
      const imgData = canvas.toDataURL("image/png");
      let position = 28;
      let remainingHeight = imgHeight;

      // Handle multi-page content
      while (remainingHeight > 0) {
        const currentHeight = Math.min(remainingHeight, pageHeight - position);
        
        pdf.addImage(
          imgData,
          "PNG",
          0,
          position - ((imgHeight - remainingHeight) * imgWidth) / canvas.width,
          imgWidth,
          imgHeight
        );

        remainingHeight -= currentHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          position = 10;
        }
      }

      // Save PDF
      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`${filename}_${dateStr}.pdf`);

    } catch (error) {
      console.error("Error exporting PDF:", error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToPDF, isExporting };
}

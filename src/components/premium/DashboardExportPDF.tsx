import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface DashboardExportPDFProps {
  containerId: string;
  dateRange?: DateRange;
}

export function DashboardExportPDF({ containerId, dateRange }: DashboardExportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const element = document.getElementById(containerId);
    
    if (!element) {
      toast.error("Erro ao capturar dashboard");
      return;
    }

    setIsExporting(true);
    
    try {
      // Capture the dashboard
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      // Create PDF in landscape
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add header with date range
      const today = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const periodText = dateRange?.from && dateRange?.to
        ? `Período: ${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
        : "Período não definido";

      pdf.setFontSize(16);
      pdf.setTextColor(33, 33, 33);
      pdf.text("Dashboard de Vendas", 14, 15);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(periodText, 14, 22);
      pdf.text(`Gerado em: ${today}`, pageWidth - 14, 15, { align: "right" });

      // Add the captured image
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // If image is too tall, scale it down
      const maxImgHeight = pageHeight - 35;
      const finalHeight = Math.min(imgHeight, maxImgHeight);
      const finalWidth = (canvas.width * finalHeight) / canvas.height;

      pdf.addImage(imgData, "PNG", 10, 28, finalWidth, finalHeight);

      // Save the PDF
      const fileName = `dashboard-vendas-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fileName);
      
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      Exportar PDF
    </Button>
  );
}

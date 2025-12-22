import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateReportParams {
  report_type: string;
  filters: {
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    agentId?: string;
    status?: string;
    pipelineId?: string;
  };
  format: 'csv' | 'pdf';
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: async (params: GenerateReportParams) => {
      console.log('Generating report with params:', params);

      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: params,
      });

      if (error) {
        console.error('Error generating report:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Report generated successfully:', data);

      // For CSV, create download
      if (variables.format === 'csv' && typeof data === 'string') {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_${variables.report_type}_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Relatório baixado com sucesso!', {
          description: 'Verifique sua pasta de downloads',
        });
      } else if (variables.format === 'pdf') {
        // For PDF, we would generate and download here
        toast.info('PDF em desenvolvimento', {
          description: 'Por enquanto, use o formato CSV',
        });
      }
    },
    onError: (error: any) => {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório', {
        description: error.message || 'Tente novamente mais tarde',
      });
    },
  });
}

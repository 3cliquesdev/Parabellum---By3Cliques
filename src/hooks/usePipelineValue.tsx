import { useDeals, DealFilters } from "./useDeals";

export function usePipelineValue(startDate?: Date, endDate?: Date) {
  // Constrói filtros de data se fornecidos
  const filters: DealFilters | undefined = startDate && endDate 
    ? {
        createdDateRange: { from: startDate, to: endDate },
        leadSource: [],
        search: '',
      } 
    : undefined;

  const { data: deals, isLoading } = useDeals(undefined, filters);

  if (isLoading || !deals) {
    return {
      totalPipelineValue: 0,
      weightedValue: 0,
      isLoading: true,
    };
  }

  // Filtrar apenas deals abertos
  const openDeals = deals.filter((deal) => deal.status === "open");

  // Calcular valor total no pipeline
  const totalPipelineValue = openDeals.reduce(
    (sum, deal) => sum + (deal.value || 0),
    0
  );

  // Calcular valor ponderado (valor * probabilidade)
  const weightedValue = openDeals.reduce(
    (sum, deal) => sum + (deal.value || 0) * ((deal.probability || 50) / 100),
    0
  );

  return {
    totalPipelineValue,
    weightedValue,
    isLoading: false,
  };
}

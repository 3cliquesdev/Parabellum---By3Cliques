import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PivotRow } from "@/hooks/useCommercialConversationsPivot";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CommercialPivotTableProps {
  data: PivotRow[] | undefined;
  isLoading: boolean;
  onCellClick: (departmentId: string | null, categoryId: string | null, noTag: boolean) => void;
}

interface PivotMatrix {
  departments: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  matrix: Map<string, number>;
  totals: { byDept: Map<string, number>; byCat: Map<string, number>; grand: number };
}

export function CommercialPivotTable({ data, isLoading, onCellClick }: CommercialPivotTableProps) {
  const pivot = useMemo<PivotMatrix>(() => {
    if (!data || data.length === 0) {
      return {
        departments: [],
        categories: [],
        matrix: new Map(),
        totals: { byDept: new Map(), byCat: new Map(), grand: 0 },
      };
    }

    const deptSet = new Map<string, string>();
    const catSet = new Map<string, string>();
    const matrix = new Map<string, number>();
    const byDept = new Map<string, number>();
    const byCat = new Map<string, number>();
    let grand = 0;

    data.forEach((row) => {
      const deptKey = row.department_id;
      const catKey = row.category;

      deptSet.set(row.department_id, row.department_name);
      catSet.set(row.category, row.category);

      const key = `${deptKey}|${catKey}`;
      matrix.set(key, (matrix.get(key) || 0) + Number(row.conversation_count));

      byDept.set(row.department_id, (byDept.get(row.department_id) || 0) + Number(row.conversation_count));
      byCat.set(row.category, (byCat.get(row.category) || 0) + Number(row.conversation_count));
      grand += Number(row.conversation_count);
    });

    const departments = Array.from(deptSet.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const categories = Array.from(catSet.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.id === "sem_tag") return 1;
        if (b.id === "sem_tag") return -1;
        return a.name.localeCompare(b.name);
      });

    return { departments, categories, matrix, totals: { byDept, byCat, grand } };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pivot: Departamento x Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (pivot.departments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pivot: Departamento x Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhum dado encontrado para os filtros selecionados
          </p>
        </CardContent>
      </Card>
    );
  }

  const getMatrixValue = (deptId: string | null, catId: string | null): number => {
    const key = `${deptId || "__null__"}|${catId || "__null__"}`;
    return pivot.matrix.get(key) || 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pivot: Departamento x Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[600px]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted text-left font-semibold">Departamento</th>
                  {pivot.categories.map((cat) => (
                    <th
                      key={cat.id || "null"}
                      className="border p-2 bg-muted text-center font-semibold"
                    >
                      <span className="truncate max-w-[120px]">
                        {cat.id === "sem_tag" ? "Sem Tag" : cat.name}
                      </span>
                    </th>
                  ))}
                  <th className="border p-2 bg-muted/80 text-center font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pivot.departments.map((dept) => (
                  <tr key={dept.id || "null"} className="hover:bg-muted/30">
                    <td className="border p-2 font-medium">{dept.name}</td>
                    {pivot.categories.map((cat) => {
                      const value = getMatrixValue(dept.id, cat.id);
                      return (
                        <td
                          key={cat.id || "null"}
                          className="border p-2 text-center cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => onCellClick(dept.id, cat.id, cat.id === null)}
                        >
                          {value > 0 ? (
                            <Badge variant="secondary" className="font-mono">
                              {value}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border p-2 text-center bg-muted/30 font-bold">
                      {pivot.totals.byDept.get(dept.id) || 0}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/50 font-bold">
                  <td className="border p-2">Total</td>
                  {pivot.categories.map((cat) => (
                    <td key={cat.id || "null"} className="border p-2 text-center">
                      {pivot.totals.byCat.get(cat.id) || 0}
                    </td>
                  ))}
                  <td className="border p-2 text-center">{pivot.totals.grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

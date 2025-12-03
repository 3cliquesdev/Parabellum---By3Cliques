import * as React from "react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface ResponsiveDataViewProps<T> {
  data: T[];
  columns: Column<T>[];
  cardRender: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  tableClassName?: string;
  cardsClassName?: string;
}

export function ResponsiveDataView<T>({
  data,
  columns,
  cardRender,
  keyExtractor,
  onRowClick,
  emptyMessage = "Nenhum item encontrado",
  className,
  tableClassName,
  cardsClassName,
}: ResponsiveDataViewProps<T>) {
  const isMobile = useIsMobileBreakpoint();

  if (data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-12 text-center", className)}>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Mobile: Card List
  if (isMobile) {
    return (
      <div className={cn("divide-y divide-border bg-card rounded-lg border border-border", cardsClassName)}>
        {data.map((item, index) => (
          <div
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(onRowClick && "cursor-pointer active:bg-muted/50")}
          >
            {cardRender(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Table
  return (
    <div className={cn("rounded-lg border border-border bg-card", tableClassName)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

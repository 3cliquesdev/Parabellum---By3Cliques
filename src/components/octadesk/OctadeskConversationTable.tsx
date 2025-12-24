import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ThumbsUp, ThumbsDown, MessageSquare, Building2, Tag, Calendar } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  OctadeskConversation, 
  OctadeskFilters, 
  filterConversations, 
  getUniqueDepartments 
} from '@/utils/octadeskParser';

interface OctadeskConversationTableProps {
  conversations: OctadeskConversation[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function OctadeskConversationTable({
  conversations,
  selectedIds,
  onSelectionChange,
}: OctadeskConversationTableProps) {
  const [filters, setFilters] = useState<OctadeskFilters>({
    satisfaction: 'all',
    minMessages: 3,
    startDate: null,
    endDate: null,
    department: null,
  });

  const departments = useMemo(() => getUniqueDepartments(conversations), [conversations]);
  
  const filteredConversations = useMemo(
    () => filterConversations(conversations, filters),
    [conversations, filters]
  );

  const allFilteredSelected = filteredConversations.length > 0 && 
    filteredConversations.every(c => selectedIds.has(c.id));

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      const newIds = new Set(selectedIds);
      filteredConversations.forEach(c => newIds.delete(c.id));
      onSelectionChange(newIds);
    } else {
      // Select all filtered
      const newIds = new Set(selectedIds);
      filteredConversations.forEach(c => newIds.add(c.id));
      onSelectionChange(newIds);
    }
  };

  const handleSelectOne = (id: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) {
      newIds.delete(id);
    } else {
      newIds.add(id);
    }
    onSelectionChange(newIds);
  };

  const getSatisfactionIcon = (satisfaction: OctadeskConversation['satisfaction']) => {
    if (satisfaction === 'satisfied') {
      return <ThumbsUp className="h-4 w-4 text-green-500" />;
    }
    if (satisfaction === 'unsatisfied') {
      return <ThumbsDown className="h-4 w-4 text-red-500" />;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filters.satisfaction}
            onValueChange={(value: OctadeskFilters['satisfaction']) => 
              setFilters(f => ({ ...f, satisfaction: value }))
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Avaliação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="satisfied">Satisfeito</SelectItem>
              <SelectItem value="unsatisfied">Insatisfeito</SelectItem>
              <SelectItem value="none">Sem avaliação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filters.department || 'all'}
            onValueChange={(value) => 
              setFilters(f => ({ ...f, department: value === 'all' ? null : value }))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Mín. msgs:</span>
          <Input
            type="number"
            min={1}
            max={50}
            value={filters.minMessages}
            onChange={(e) => setFilters(f => ({ ...f, minMessages: parseInt(e.target.value) || 1 }))}
            className="w-[80px]"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">
            {filteredConversations.length} de {conversations.length} conversas
          </span>
          <span className="text-sm font-medium text-primary">
            ({selectedIds.size} selecionadas)
          </span>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[120px]">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data
                </div>
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[80px] text-center">Avaliação</TableHead>
              <TableHead className="w-[80px] text-center">Msgs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConversations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma conversa encontrada com os filtros aplicados
                </TableCell>
              </TableRow>
            ) : (
              filteredConversations.map((conv) => (
                <TableRow 
                  key={conv.id}
                  className={selectedIds.has(conv.id) ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(conv.id)}
                      onCheckedChange={() => handleSelectOne(conv.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(conv.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">{conv.clientName}</p>
                      {conv.clientEmail && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {conv.clientEmail}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {conv.department}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {conv.publicTags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {conv.publicTags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{conv.publicTags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getSatisfactionIcon(conv.satisfaction)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{conv.messagesCount}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Selection Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
          <span className="font-medium">
            {selectedIds.size} conversa{selectedIds.size !== 1 ? 's' : ''} selecionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}
    </div>
  );
}

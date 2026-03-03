import { Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useUsersByDepartment } from "@/hooks/useUsersByDepartment";
import { cn } from "@/lib/utils";

interface TransferPropertiesPanelProps {
  selectedNode: Node;
  updateNodeData: (key: string, value: unknown) => void;
}

export function TransferPropertiesPanel({ selectedNode, updateNodeData }: TransferPropertiesPanelProps) {
  // Buscar departamentos ativos
  const { data: departments = [] } = useDepartments({ activeOnly: true });

  // Buscar agentes do departamento selecionado (para tipo "agent")
  const selectedDeptForAgent = selectedNode?.data?.transfer_type === "agent" 
    ? selectedNode?.data?.department_id 
    : undefined;
  const { data: departmentAgents = [] } = useUsersByDepartment(selectedDeptForAgent);

  const transferType = selectedNode.data.transfer_type || "department";

  return (
    <div className="space-y-3">
      {/* Tipo de transferência */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de transferência</Label>
        <Select
          value={transferType}
          onValueChange={(v) => {
            updateNodeData("transfer_type", v);
            // Limpar seleções anteriores ao trocar tipo
            updateNodeData("department_id", null);
            updateNodeData("department_name", null);
            updateNodeData("agent_id", null);
            updateNodeData("agent_name", null);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent 
            position="popper" 
            side="bottom" 
            align="start"
            sideOffset={4}
            className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
          >
            <SelectItem value="department">Departamento</SelectItem>
            <SelectItem value="queue">Fila de atendimento</SelectItem>
            <SelectItem value="agent">Agente específico</SelectItem>
            <SelectItem value="consultant">Consultor do cliente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selecionar Departamento - aparece para "department", "agent" e "consultant" (fallback) */}
      {(transferType === "department" || transferType === "agent" || transferType === "consultant") && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            {transferType === "agent" ? "Departamento do agente" : transferType === "consultant" ? "Departamento fallback" : "Departamento destino"}
          </Label>
          <Select
            value={selectedNode.data.department_id || ""}
            onValueChange={(v) => {
              const dept = departments.find(d => d.id === v);
              updateNodeData("department_id", v);
              updateNodeData("department_name", dept?.name || "");
              // Limpar agente se mudou departamento
              if (transferType === "agent") {
                updateNodeData("agent_id", null);
                updateNodeData("agent_name", null);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um departamento" />
            </SelectTrigger>
            <SelectContent 
              position="popper" 
              side="bottom" 
              align="start"
              sideOffset={4}
              className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
            >
              {departments.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  Nenhum departamento ativo
                </div>
              ) : (
                departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: dept.color }}
                      />
                      <span>{dept.name}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selecionar Agente - aparece apenas para "agent" APÓS selecionar departamento */}
      {transferType === "agent" && selectedNode.data.department_id && (
        <div className="space-y-1.5">
          <Label className="text-xs">Agente</Label>
          <Select
            value={selectedNode.data.agent_id || ""}
            onValueChange={(v) => {
              const agent = departmentAgents.find(a => a.id === v);
              updateNodeData("agent_id", v);
              updateNodeData("agent_name", agent?.full_name || "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente" />
            </SelectTrigger>
            <SelectContent 
              position="popper" 
              side="bottom" 
              align="start"
              sideOffset={4}
              className="z-[100] max-h-[200px] overflow-y-auto bg-popover text-popover-foreground shadow-lg border"
            >
              {departmentAgents.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  Nenhum agente neste departamento
                </div>
              ) : (
                departmentAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        agent.availability_status === "online" ? "bg-emerald-500" : 
                        agent.availability_status === "busy" ? "bg-amber-500" : "bg-muted-foreground/50"
                      )} />
                      <span>{agent.full_name}</span>
                      {agent.job_title && (
                        <span className="text-muted-foreground text-xs">({agent.job_title})</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mensagem de info para Consultor */}
      {transferType === "consultant" && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
          A conversa será direcionada ao consultor vinculado ao contato. Se não houver consultor, vai para o pool do departamento selecionado acima.
        </div>
      )}

      {/* Mensagem de info para Fila */}
      {transferType === "queue" && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
          A conversa será adicionada à fila geral de atendimento e distribuída automaticamente para o próximo agente disponível.
        </div>
      )}

      {/* Feedback visual quando configurado */}
      {transferType === "department" && selectedNode.data.department_name && (
        <div className="text-xs bg-primary/10 text-primary p-2.5 rounded-lg flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full shrink-0" 
            style={{ backgroundColor: departments.find(d => d.id === selectedNode.data.department_id)?.color || 'hsl(var(--primary))' }}
          />
          Transferir para: <strong>{selectedNode.data.department_name}</strong>
        </div>
      )}

      {transferType === "agent" && selectedNode.data.agent_name && (
        <div className="text-xs bg-primary/10 text-primary p-2.5 rounded-lg">
          Transferir para: <strong>{selectedNode.data.agent_name}</strong>
          {selectedNode.data.department_name && (
            <span className="text-muted-foreground"> ({selectedNode.data.department_name})</span>
          )}
        </div>
      )}
    </div>
  );
}

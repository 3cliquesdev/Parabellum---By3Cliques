import { useState } from "react";
import { Trash2, RefreshCw, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hardRefresh } from "@/lib/build/ensureLatestBuild";
import { APP_SCHEMA_VERSION } from "@/lib/build/schemaVersion";
import { toast } from "sonner";

export function SystemMaintenanceCard() {
  const [clearing, setClearing] = useState(false);

  const handleReset = async () => {
    setClearing(true);
    toast.info("Limpando todos os caches...", {
      description: "Você permanecerá logado."
    });
    await new Promise(r => setTimeout(r, 500));
    await hardRefresh();
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-card">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-500">
        <HardDrive className="h-6 w-6 text-white" />
      </div>
      
      <div className="text-center space-y-1">
        <span className="font-medium text-sm text-foreground block">Manutenção</span>
        <span className="text-xs text-muted-foreground">v{APP_SCHEMA_VERSION}</span>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={handleReset}
        disabled={clearing}
        className="w-full"
      >
        {clearing ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        {clearing ? "Limpando..." : "Limpar Cache"}
      </Button>
    </div>
  );
}

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Banknote, Activity, Star } from "lucide-react";
import { AITelemetryContent } from "@/pages/AITelemetry";
import { SaqueTelemetryContent } from "@/pages/SaqueTelemetry";
import { AIResolutionContent } from "@/pages/AIResolution";
import { AIQualityContent } from "@/components/dashboard/AIQualityContent";

export function AIUnifiedTab() {
  const [subTab, setSubTab] = useState("resolution");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="resolution" className="gap-2 text-xs">
            <Bot className="h-3.5 w-3.5" />
            Resolução IA
          </TabsTrigger>
          <TabsTrigger value="quality" className="gap-2 text-xs">
            <Star className="h-3.5 w-3.5" />
            Qualidade
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="gap-2 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Telemetria
          </TabsTrigger>
          <TabsTrigger value="saque" className="gap-2 text-xs">
            <Banknote className="h-3.5 w-3.5" />
            Saque & OTP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resolution">
          <AIResolutionContent />
        </TabsContent>

        <TabsContent value="quality">
          <AIQualityContent />
        </TabsContent>

        <TabsContent value="telemetry">
          <AITelemetryContent />
        </TabsContent>

        <TabsContent value="saque">
          <SaqueTelemetryContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

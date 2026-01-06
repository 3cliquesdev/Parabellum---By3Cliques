import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormSchema } from "@/hooks/useForms";
import PublicFormV2 from "@/pages/PublicFormV2";
import { useState } from "react";
import { Smartphone, Monitor } from "lucide-react";

interface FormPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FormSchema;
  name?: string;
  title?: string;
  description?: string;
}

const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

export function FormPreviewModal({ open, onOpenChange, schema, name, title, description }: FormPreviewModalProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
        {/* Device Toggle */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <Tabs value={device} onValueChange={(v) => setDevice(v as any)}>
            <TabsList>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Preview Container */}
        <div className="absolute inset-0 top-16 flex items-center justify-center bg-muted/50 p-8">
          {device === "mobile" ? (
            <div 
              className="bg-background rounded-[40px] border-[8px] border-foreground/20 shadow-2xl overflow-y-auto"
              style={{ width: MOBILE_WIDTH, height: MOBILE_HEIGHT }}
            >
              <PublicFormV2 
                schema={schema} 
                isPreview 
                formName={name} 
                formTitle={title} 
                formDescription={description}
              />
            </div>
          ) : (
            <div className="w-full h-full rounded-lg shadow-lg bg-background overflow-y-auto">
              <PublicFormV2 
                schema={schema} 
                isPreview 
                formName={name} 
                formTitle={title} 
                formDescription={description}
                isEmbedded
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

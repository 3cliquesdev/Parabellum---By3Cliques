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
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 !flex !flex-col gap-0">
        {/* Device Toggle */}
        <div className="shrink-0 flex justify-center py-4 border-b bg-background z-10">
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

        {/* Preview Container - scrollable area */}
        <div className="flex-1 overflow-y-auto bg-muted/50">
          <div className="min-h-full p-8 flex items-start justify-center">
            {device === "mobile" ? (
              <div 
                className="shrink-0 bg-background rounded-[40px] border-[8px] border-foreground/20 shadow-2xl overflow-y-auto"
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
              <div className="w-full max-w-4xl rounded-lg shadow-lg bg-background">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

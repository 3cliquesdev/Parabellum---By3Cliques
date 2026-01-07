import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormSchema } from "@/hooks/useForms";
import PublicFormV2 from "@/pages/PublicFormV2";
import { useState } from "react";
import { Smartphone, Monitor, X } from "lucide-react";

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
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg rounded-lg"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '95vw',
            maxWidth: '95vw',
            height: '90vh',
            maxHeight: '90vh',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Close Button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

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

          {/* Preview Container */}
          {device === "mobile" ? (
            <div 
              className="flex-1 min-h-0 overflow-y-auto bg-muted/50 flex items-start justify-center p-8"
            >
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
            </div>
          ) : (
            <div className="flex-1 min-h-0 bg-muted/50 p-8 flex items-start justify-center">
              <div 
                className="w-full max-w-4xl bg-background rounded-lg shadow-lg overflow-y-auto"
                style={{ maxHeight: 'calc(90vh - 140px)' }}
              >
                <PublicFormV2 
                  schema={schema} 
                  isPreview 
                  formName={name} 
                  formTitle={title} 
                  formDescription={description}
                />
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

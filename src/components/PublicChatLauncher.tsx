import { useState } from "react";
import { MessageSquare, MessageCircle, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDepartments } from "@/hooks/useDepartments";

interface PublicChatLauncherProps {
  defaultDepartment?: string;
}

export default function PublicChatLauncher({ defaultDepartment }: PublicChatLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: departments } = useDepartments();
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  // Encontrar departamento configurado
  const dept = departments?.find(
    (d) => d.is_active && (d.name.toLowerCase() === defaultDepartment?.toLowerCase() || d.id === defaultDepartment)
  );
  
  const whatsappNumber = dept?.whatsapp_number;

  const handleWhatsApp = () => {
    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber}?text=Olá, preciso de ajuda`, "_blank");
    }
  };

  const handleLiveChat = () => {
    const url = defaultDepartment 
      ? `/public-chat?source=widget&dept=${defaultDepartment}`
      : "/public-chat?source=widget";
    window.location.href = url;
  };

  const handleOpenTicket = () => {
    window.location.href = "/open-ticket";
  };

  // Botão flutuante
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu popup */}
      {isOpen && (
        <Card className="mb-4 shadow-xl border-2 animate-in slide-in-from-bottom-5 duration-300">
          <CardContent className="p-4 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Como podemos ajudar?</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {/* WhatsApp - Priorizado no mobile */}
              {whatsappNumber && (
                <Button
                  variant="outline"
                  className={`w-full justify-start gap-3 h-auto py-3 hover:bg-green-50 hover:border-green-500 ${
                    isMobile ? "border-green-500 bg-green-50" : ""
                  }`}
                  onClick={handleWhatsApp}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold">WhatsApp</div>
                    <div className="text-xs text-muted-foreground">Resposta rápida via WhatsApp</div>
                  </div>
                </Button>
              )}
              
              {/* Chat ao Vivo - Priorizado no desktop */}
              <Button
                variant="outline"
                className={`w-full justify-start gap-3 h-auto py-3 hover:bg-blue-50 hover:border-blue-500 ${
                  !isMobile && !whatsappNumber ? "border-blue-500 bg-blue-50" : ""
                }`}
                onClick={handleLiveChat}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">Chat ao Vivo</div>
                  <div className="text-xs text-muted-foreground">Converse em tempo real</div>
                </div>
              </Button>
              
              {/* Abrir Ticket */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 hover:bg-amber-50 hover:border-amber-500"
                onClick={handleOpenTicket}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                  <Ticket className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">Abrir Ticket</div>
                  <div className="text-xs text-muted-foreground">Envie sua solicitação</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Botão flutuante principal */}
      <Button
        size="lg"
        className="h-14 w-14 rounded-full shadow-xl hover:scale-110 transition-transform bg-primary"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Play, MessageCircle, Sparkles, Gift, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

interface ThankYouViewProps {
  customerName: string;
  productName: string;
  supportPhone: string;
  onStart: () => void;
}

export function ThankYouView({ customerName, productName, supportPhone, onStart }: ThankYouViewProps) {
  const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Olá! Sou ${customerName}, acabei de comprar e quero suporte guiado no onboarding.`
  )}`;

  useEffect(() => {
    // Fire confetti on mount
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#2563EB", "#10B981", "#F59E0B", "#EC4899"],
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        {/* Main Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-primary to-emerald-500 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Gift className="w-10 h-10" />
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Obrigado pela sua compra! 🎉
              </h1>
              <p className="text-xl opacity-90 font-medium">
                {customerName}
              </p>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center mb-8"
            >
              <p className="text-lg text-muted-foreground leading-relaxed">
                Bem-vindo ao <span className="font-semibold text-foreground">{productName}</span>! 
                Estamos animados para te ajudar a ter os melhores resultados.
              </p>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-4 mb-8"
            >
              {[
                { icon: Sparkles, label: "Passo a passo", color: "text-primary" },
                { icon: Star, label: "Dicas exclusivas", color: "text-amber-500" },
                { icon: MessageCircle, label: "Suporte 24h", color: "text-emerald-500" },
              ].map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-muted/50">
                  <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={onStart}
                size="lg"
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <Play className="w-5 h-5 mr-2" />
                Iniciar meu Onboarding Guiado
              </Button>
            </motion.div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-800 px-3 text-muted-foreground">
                  ou prefere ajuda humana?
                </span>
              </div>
            </div>

            {/* WhatsApp Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-6 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 hover:border-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                    <QRCodeSVG
                      value={whatsappUrl}
                      size={80}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Prefiro ser guiado por WhatsApp
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Escaneie o QR Code ou clique para iniciar uma conversa com nossa equipe de suporte.
                    </p>
                  </div>
                </div>
              </a>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-muted/30 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Precisa de ajuda? Entre em contato: suporte@exemplo.com
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { 
  Trophy, 
  MessageCircle, 
  Calendar, 
  Share2, 
  Star,
  Rocket,
  PartyPopper
} from "lucide-react";
import confetti from "canvas-confetti";

interface CelebrationViewProps {
  customerName: string;
  supportPhone: string;
}

export function CelebrationView({ customerName, supportPhone }: CelebrationViewProps) {
  const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Olá! Sou ${customerName}, acabei de completar meu onboarding! 🎉`
  )}`;

  useEffect(() => {
    // Fire celebratory confetti
    const duration = 5000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#2563EB", "#10B981", "#F59E0B", "#EC4899"],
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#2563EB", "#10B981", "#F59E0B", "#EC4899"],
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-primary to-purple-600 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Trophy className="w-12 h-12" />
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Parabéns, {customerName}! 🎉
                </h1>
                <p className="text-xl opacity-90">
                  Você completou seu onboarding com sucesso!
                </p>
              </motion.div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-8"
            >
              <p className="text-lg text-muted-foreground leading-relaxed">
                Você está pronto para começar a ter resultados incríveis! 
                Aproveite todas as funcionalidades que preparamos para você.
              </p>
            </motion.div>

            {/* Achievement Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              {[
                { icon: Star, label: "100%", sublabel: "Completo", color: "text-amber-500" },
                { icon: Rocket, label: "Pronto", sublabel: "Para decolar", color: "text-primary" },
                { icon: PartyPopper, label: "VIP", sublabel: "Acesso", color: "text-purple-500" },
                { icon: Trophy, label: "Expert", sublabel: "Nível", color: "text-emerald-500" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="text-center p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border"
                >
                  <item.icon className={`w-8 h-8 mx-auto mb-2 ${item.color}`} />
                  <p className="font-bold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Next Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="space-y-3 mb-8"
            >
              <h3 className="font-semibold text-foreground text-center mb-4">
                Próximos Passos Recomendados
              </h3>
              
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 hover:border-emerald-400 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Falar com nosso time
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Tire suas dúvidas e receba dicas personalizadas
                  </p>
                </div>
              </a>

              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary/40 transition-all group">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-primary">
                    Agendar Mentoria
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Sessão exclusiva de 30 minutos
                  </p>
                </div>
              </button>

              <button className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 hover:border-purple-400 transition-all group">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <Share2 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-400">
                    Indicar um Amigo
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Ganhe benefícios exclusivos
                  </p>
                </div>
              </button>
            </motion.div>

            {/* WhatsApp QR */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-center"
            >
              <p className="text-sm text-muted-foreground mb-3">
                Ou escaneie para falar conosco no WhatsApp
              </p>
              <div className="inline-block p-3 bg-white rounded-xl shadow-sm">
                <QRCodeSVG value={whatsappUrl} size={100} level="M" />
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-muted/30 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Obrigado por fazer parte da nossa comunidade! 💙
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

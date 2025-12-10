import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Rocket, PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingCompleteProps {
  completedAt: string | null;
}

export function OnboardingComplete({ completedAt }: OnboardingCompleteProps) {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!showConfetti) {
      setShowConfetti(true);
      
      // Dispara confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: ReturnType<typeof setInterval> = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showConfetti]);

  return (
    <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <PartyPopper className="absolute -top-2 -right-2 h-8 w-8 text-amber-500" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          Parabéns! 🎉
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Você completou todas as etapas do onboarding. Seu CRM está pronto para uso!
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            <Rocket className="h-5 w-5 mr-2" />
            Ir para o Dashboard
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/inbox")}
          >
            Começar a Atender
          </Button>
        </div>

        {completedAt && (
          <p className="text-xs text-muted-foreground mt-6">
            Concluído em {new Date(completedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

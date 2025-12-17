import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, HelpCircle, Sparkles } from "lucide-react";

interface QuizOption {
  id?: string;
  text?: string;
}

interface QuizCardProps {
  question: string;
  options: (string | QuizOption)[];
  correctOption: string;
  passed: boolean;
  onPass: () => void;
}

// Helper to normalize option to string
const getOptionText = (option: string | QuizOption): string => {
  if (typeof option === 'string') return option;
  return option?.text || option?.id || '';
};

export function QuizCard({ question, options, correctOption, passed, onPass }: QuizCardProps) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (!selectedOption) return;
    
    const correct = selectedOption === correctOption;
    setIsCorrect(correct);
    setSubmitted(true);
    
    if (correct) {
      onPass();
    }
  };

  const handleRetry = () => {
    setSelectedOption("");
    setSubmitted(false);
    setIsCorrect(false);
  };

  if (passed) {
    return (
      <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
              Quiz Completado! 🎉
            </h4>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
              Você acertou a resposta correta.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-1">Quiz Rápido</h4>
          <p className="text-sm text-muted-foreground">
            Responda corretamente para concluir esta etapa
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-base font-medium text-foreground">{question}</p>
      </div>

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RadioGroup
              value={selectedOption}
              onValueChange={setSelectedOption}
              className="space-y-2 mb-4"
            >
              {options.map((option, index) => {
                const optionText = getOptionText(option);
                return (
                  <Label
                    key={index}
                    htmlFor={`option-${index}`}
                    className={`
                      flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedOption === optionText 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }
                    `}
                  >
                    <RadioGroupItem value={optionText} id={`option-${index}`} />
                    <span className="text-sm">{optionText}</span>
                  </Label>
                );
              })}
            </RadioGroup>

            <Button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="w-full bg-gradient-to-r from-primary to-purple-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Verificar Resposta
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              p-4 rounded-lg border-2 
              ${isCorrect 
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" 
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }
            `}
          >
            <div className="flex items-start gap-3">
              {isCorrect ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h5 className={`font-semibold mb-1 ${isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {isCorrect ? "Parabéns! Resposta correta! 🎉" : "Ops! Resposta incorreta"}
                </h5>
                <p className={`text-sm ${isCorrect ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-red-600/80 dark:text-red-400/80"}`}>
                  {isCorrect 
                    ? "Você demonstrou conhecimento nesta etapa." 
                    : "Revise o conteúdo e tente novamente."
                  }
                </p>
                
                {!isCorrect && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="mt-3"
                  >
                    Tentar Novamente
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

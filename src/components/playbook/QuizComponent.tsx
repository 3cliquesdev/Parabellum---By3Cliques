import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert } from '@/components/ui/alert';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface QuizOption {
  id: string;
  text: string;
}

interface QuizComponentProps {
  question: string;
  options: QuizOption[];
  correctOption: string;
  onPass: () => void;
  disabled?: boolean;
  passed?: boolean;
}

export function QuizComponent({
  question,
  options,
  correctOption,
  onPass,
  disabled = false,
  passed = false,
}: QuizComponentProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(passed);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleAnswer = () => {
    if (!selectedOption) return;

    setAttempts(attempts + 1);

    if (selectedOption === correctOption) {
      // ACERTOU!
      setShowSuccess(true);
      setShowError(false);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563EB', '#3B82F6', '#60A5FA'],
      });
      onPass();
    } else {
      // ERROU!
      setShowError(true);
      setShowSuccess(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <Card
      className={cn(
        'p-6 space-y-4 border-2 transition-all',
        showSuccess && 'border-green-500 bg-green-50 dark:bg-green-950',
        showError && 'border-red-500 bg-red-50 dark:bg-red-950',
        shake && 'animate-shake'
      )}
    >
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        📝 Trava de Conhecimento
      </h3>

      {disabled && !passed && (
        <Alert className="bg-yellow-50 border-yellow-500 dark:bg-yellow-950">
          🎬 Assista ao vídeo completo para liberar o quiz
        </Alert>
      )}

      <p className="text-foreground font-medium">{question}</p>

      <RadioGroup
        value={selectedOption}
        onValueChange={setSelectedOption}
        disabled={disabled || passed}
      >
        {options.map((option) => (
          <div
            key={option.id}
            className={cn(
              'flex items-center space-x-2 p-3 rounded-lg border transition-colors',
              selectedOption === option.id && 'bg-primary/10 border-primary',
              (disabled || passed) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RadioGroupItem value={option.id} id={option.id} disabled={disabled || passed} />
            <Label
              htmlFor={option.id}
              className={cn('cursor-pointer flex-1', (disabled || passed) && 'cursor-not-allowed')}
            >
              {option.text}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {showError && (
        <Alert variant="destructive">
          ❌ Resposta incorreta. Assista ao vídeo novamente!
        </Alert>
      )}

      {showSuccess && (
        <Alert className="border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          ✅ Correto! Parabéns! 🎉
        </Alert>
      )}

      <Button onClick={handleAnswer} disabled={!selectedOption || disabled || passed} className="w-full">
        {passed ? '✅ Quiz Concluído' : 'Responder'}
      </Button>

      {attempts > 0 && !passed && (
        <p className="text-xs text-muted-foreground text-center">
          Tentativas: {attempts}
        </p>
      )}
    </Card>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RatingFieldProps {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const EMOJIS = ["😡", "😠", "😤", "😞", "😐", "🙂", "😊", "😃", "😄", "🤩", "🥳"];

export function RatingField({ value, onChange, min = 0, max = 10 }: RatingFieldProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const displayValue = hoveredValue ?? value;

  const getColor = (num: number) => {
    const normalizedValue = (num - min) / (max - min);
    if (normalizedValue <= 0.3) return "bg-red-500 hover:bg-red-400";
    if (normalizedValue <= 0.6) return "bg-yellow-500 hover:bg-yellow-400";
    return "bg-green-500 hover:bg-green-400";
  };

  const getBackgroundColor = (num: number) => {
    if (value === num) return getColor(num);
    return "bg-muted hover:bg-muted/80";
  };

  return (
    <div className="space-y-6">
      {/* Emoji Display */}
      <div className="flex justify-center">
        <motion.div
          key={displayValue}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="text-6xl"
        >
          {displayValue !== null ? EMOJIS[Math.min(displayValue, EMOJIS.length - 1)] : "🤔"}
        </motion.div>
      </div>

      {/* Number Buttons */}
      <div className="flex justify-center gap-2 flex-wrap">
        {numbers.map((num) => (
          <motion.button
            key={num}
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onMouseEnter={() => setHoveredValue(num)}
            onMouseLeave={() => setHoveredValue(null)}
            onClick={() => onChange(num)}
            className={cn(
              "h-12 w-12 rounded-full text-lg font-bold transition-colors",
              getBackgroundColor(num),
              value === num && "ring-2 ring-offset-2 ring-offset-background ring-white"
            )}
          >
            {num}
          </motion.button>
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-sm text-muted-foreground px-2">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>
    </div>
  );
}

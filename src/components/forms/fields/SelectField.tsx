import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectFieldProps {
  value: string | null;
  onChange: (value: string) => void;
  options: string[];
}

export function SelectField({ value, onChange, options }: SelectFieldProps) {
  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <motion.button
          key={option}
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(option)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all",
            value === option
              ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
              : "bg-white/5 hover:bg-white/10 border border-white/10"
          )}
        >
          <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-mono text-sm">
            {String.fromCharCode(65 + index)}
          </span>
          <span className="flex-1 text-lg">{option}</span>
          {value === option && (
            <Check className="h-5 w-5 flex-shrink-0" />
          )}
        </motion.button>
      ))}
    </div>
  );
}

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface YesNoFieldProps {
  value: string | null;
  onChange: (value: string) => void;
}

export function YesNoField({ value, onChange }: YesNoFieldProps) {
  return (
    <div className="flex gap-4 justify-center">
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange("yes")}
        className={cn(
          "flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all",
          value === "yes"
            ? "bg-green-500 text-white ring-2 ring-green-300"
            : "bg-muted hover:bg-green-500/20 hover:text-green-500"
        )}
      >
        <Check className="h-6 w-6" />
        Sim
      </motion.button>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange("no")}
        className={cn(
          "flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all",
          value === "no"
            ? "bg-red-500 text-white ring-2 ring-red-300"
            : "bg-muted hover:bg-red-500/20 hover:text-red-500"
        )}
      >
        <X className="h-6 w-6" />
        Não
      </motion.button>
    </div>
  );
}

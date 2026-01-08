import { motion } from "framer-motion";
import { FormSettings } from "@/hooks/useForms";
import { Progress } from "@/components/ui/progress";

interface FormProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  settings: FormSettings;
}

export function FormProgressIndicator({ currentStep, totalSteps, settings }: FormProgressIndicatorProps) {
  if (settings.show_progress_bar === false || totalSteps === 0) return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const style = settings.progress_style || "bar";
  const progressColor = settings.progress_color || settings.button_color || "#2563EB";
  const bgColor = settings.progress_background_color || "#374151";
  const height = settings.progress_height ?? 4;
  const animate = settings.progress_animate !== false;
  const showPercentage = settings.progress_show_percentage === true;

  // Render different styles
  const renderIndicator = () => {
    switch (style) {
      case "steps":
        return (
          <div className="flex items-center gap-2">
            <span 
              className="text-sm font-medium"
              style={{ color: progressColor }}
            >
              {currentStep + 1}
            </span>
            <span style={{ color: settings.text_color, opacity: 0.5 }}>/</span>
            <span 
              className="text-sm"
              style={{ color: settings.text_color, opacity: 0.5 }}
            >
              {totalSteps}
            </span>
            {showPercentage && (
              <span 
                className="text-xs ml-2"
                style={{ color: settings.text_color, opacity: 0.4 }}
              >
                ({Math.round(progress)}%)
              </span>
            )}
          </div>
        );

      case "dots":
        return (
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    scale: i <= currentStep ? 1 : 0.8,
                    backgroundColor: i <= currentStep ? progressColor : bgColor,
                  }}
                  transition={animate ? { duration: 0.2 } : { duration: 0 }}
                  className="rounded-full"
                  style={{
                    width: i === currentStep ? 12 : 8,
                    height: 8,
                  }}
                />
              ))}
            </div>
            {showPercentage && (
              <span 
                className="text-xs ml-2"
                style={{ color: settings.text_color, opacity: 0.5 }}
              >
                {Math.round(progress)}%
              </span>
            )}
          </div>
        );

      case "fraction":
        return (
          <div className="flex items-center gap-3">
            <motion.span 
              key={progress}
              initial={animate ? { scale: 1.2, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold"
              style={{ color: progressColor }}
            >
              {Math.round(progress)}%
            </motion.span>
            <span 
              className="text-sm"
              style={{ color: settings.text_color, opacity: 0.5 }}
            >
              concluído
            </span>
          </div>
        );

      case "bar":
      default:
        return (
          <div className="space-y-2">
            <div 
              className="w-full rounded-full overflow-hidden"
              style={{ 
                backgroundColor: bgColor,
                height: `${height}px`,
              }}
            >
              <motion.div
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={animate ? { duration: 0.3, ease: "easeOut" } : { duration: 0 }}
                className="h-full rounded-full"
                style={{ backgroundColor: progressColor }}
              />
            </div>
            {showPercentage && (
              <div className="flex justify-between text-xs" style={{ color: settings.text_color, opacity: 0.5 }}>
                <span>{currentStep + 1} de {totalSteps}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        );
    }
  };

  return renderIndicator();
}

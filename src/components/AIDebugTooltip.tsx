import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface UsedArticle {
  id: string;
  title: string;
  category: string | null;
}

interface AIDebugTooltipProps {
  usedArticles: UsedArticle[];
}

export function AIDebugTooltip({ usedArticles }: AIDebugTooltipProps) {
  if (!usedArticles || usedArticles.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              <strong className="text-slate-900 dark:text-zinc-100">Resposta Genérica</strong>
              <br />
              Nenhum artigo relevante foi encontrado na base de conhecimento.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors">
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              📚 Baseado nos artigos:
            </p>
            <div className="space-y-1.5">
              {usedArticles.map((article) => (
                <div key={article.id} className="flex items-start gap-2">
                  <span className="text-violet-600 dark:text-violet-400 text-xs mt-0.5">•</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-zinc-300 font-medium">
                      {article.title}
                    </p>
                    {article.category && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {article.category}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

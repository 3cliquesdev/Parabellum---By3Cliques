import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface KanbanScrollNavigationProps {
  children: ReactNode;
}

export function KanbanScrollNavigation({ children }: KanbanScrollNavigationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const currentScroll = el.scrollLeft;

    setShowLeftArrow(currentScroll > 10);
    setShowRightArrow(currentScroll < maxScroll - 10);
    
    // Calculate progress percentage
    const progress = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 0;
    setScrollProgress(progress);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check
    updateScrollState();

    // Check on resize
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, []);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const maxScroll = el.scrollWidth - el.clientWidth;
    
    el.scrollTo({ left: percentage * maxScroll, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Left Arrow Button */}
      {showLeftArrow && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border border-border hover:bg-accent"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}

      {/* Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="overflow-x-auto overflow-y-hidden pb-2 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>

      {/* Right Arrow Button */}
      {showRightArrow && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border border-border hover:bg-accent"
          onClick={scrollRight}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}

      {/* Progress Bar */}
      <div 
        className="mt-3 h-2 bg-muted rounded-full cursor-pointer mx-4 hover:bg-muted/80 transition-colors"
        onClick={handleProgressClick}
      >
        <div 
          className="h-full bg-primary rounded-full transition-all duration-150 min-w-[20px]"
          style={{ width: `${Math.max(scrollProgress, 5)}%` }}
        />
      </div>

      {/* Gradient Overlays for Visual Hint */}
      {showLeftArrow && (
        <div className="absolute left-10 top-0 bottom-10 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      )}
      {showRightArrow && (
        <div className="absolute right-10 top-0 bottom-10 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      )}
    </div>
  );
}

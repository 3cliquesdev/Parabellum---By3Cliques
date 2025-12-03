import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface KanbanScrollNavigationProps {
  children: ReactNode;
}

export function KanbanScrollNavigation({ children }: KanbanScrollNavigationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true); // Always show initially
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const currentScroll = el.scrollLeft;

    setShowLeftArrow(currentScroll > 10);
    setShowRightArrow(currentScroll < maxScroll - 10);
    
    const progress = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 0;
    setScrollProgress(progress);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check after children mount
    const timer = setTimeout(updateScrollState, 100);

    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(el);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [children]);

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
    <div className="flex flex-col gap-3">
      {/* Scroll Container with relative positioning for arrows */}
      <div className="relative min-h-[450px]">
        {/* Left Arrow Button - Fixed pixel position */}
        {showLeftArrow && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-0 top-[200px] z-20 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border border-border hover:bg-accent"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="overflow-x-auto overflow-y-hidden pb-4 kanban-scrollbar"
        >
          {children}
        </div>

        {/* Right Arrow Button - Fixed pixel position */}
        {showRightArrow && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-0 top-[200px] z-20 h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border border-border hover:bg-accent"
            onClick={scrollRight}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Gradient Overlays */}
        {showLeftArrow && (
          <div className="absolute left-10 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        )}
        {showRightArrow && (
          <div className="absolute right-10 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        )}
      </div>

      {/* Progress Bar - Outside the relative container */}
      <div 
        className="h-2 bg-muted rounded-full cursor-pointer mx-4 hover:bg-muted/80 transition-colors"
        onClick={handleProgressClick}
      >
        <div 
          className="h-full bg-primary rounded-full transition-all duration-150 min-w-[20px]"
          style={{ width: `${Math.max(scrollProgress, 5)}%` }}
        />
      </div>
    </div>
  );
}

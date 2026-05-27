'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { DayPicker, type MonthCaptionProps, useDayPicker } from 'react-day-picker';
import { Calendar, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string; // Prefer 'yyyy-MM-dd', also accepts ISO
  onChange: (dateString: string | undefined) => void; // Always returns 'yyyy-MM-dd' or undefined
  placeholder?: string;
  className?: string;
  label?: string;
}

/**
 * Modern, easy-to-use date picker with full calendar.
 * Timezone-safe: Always works with local calendar dates (no day shifting).
 * Returns clean 'yyyy-MM-dd' strings.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "No date set",
  className,
  label,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Safely parse to a local Date (midnight in user's timezone).
  // This prevents the classic "date flips when crossing timezones" bug.
  const parseToLocalDate = (input?: string): Date | undefined => {
    if (!input) return undefined;
    try {
      // If it's already yyyy-MM-dd, construct local midnight
      if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [y, m, d] = input.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      // Fallback for ISO strings — use local date parts to avoid shift
      const d = parseISO(input);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    } catch {
      return undefined;
    }
  };

  const selectedDate = parseToLocalDate(value);

  // Format for display (always local)
  const displayValue = value
    ? format(parseToLocalDate(value)!, 'MMM d, yyyy')
    : placeholder;

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(undefined);
      return;
    }
    // Always return clean yyyy-MM-dd using local date components (timezone safe)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
  };

  const goToToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange(undefined);
    setIsOpen(false);
  };

  const openPicker = () => {
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
  };

  // Close on outside click — robust for portals and native selects
  const cardRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      const clickedTrigger = triggerRef.current && triggerRef.current.contains(target);
      const clickedInsideCard = cardRef.current && cardRef.current.contains(target);

      if (!clickedTrigger && !clickedInsideCard) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true); // capture phase helps with native selects
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen]);

  // World-class, premium calendar header (react-day-picker v9)
  function ModernCaption({ 
    calendarMonth, 
    displayIndex,      // ← important: prevent this internal prop from reaching the DOM
    className, 
    style, 
    ...rest 
  }: MonthCaptionProps) {
    const { goToMonth, previousMonth, nextMonth } = useDayPicker();
    const displayMonth = calendarMonth?.date || new Date();

    const currentYear = displayMonth.getFullYear();
    const currentMonthIndex = displayMonth.getMonth();

    const years = Array.from({ length: 41 }, (_, i) => currentYear - 20 + i);

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = months[currentMonthIndex];

    return (
      <div
        className={cn(
          "w-full px-5 py-3 border-b-2 border-white/10 bg-white/[0.04]",
          className
        )}
        style={style}
        {...rest}
      >
        {/* Row 1: Month — prominent and beautiful */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => previousMonth && goToMonth(previousMonth)}
            onMouseDown={e => e.stopPropagation()}
            className="p-2 -ml-1 rounded-xl text-[#a1a1aa] hover:text-white hover:bg-white/10 active:bg-white/5 transition-all"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="text-[22px] font-semibold text-white tracking-[-0.04em]">
            {monthName}
          </div>

          <button
            type="button"
            onClick={() => nextMonth && goToMonth(nextMonth)}
            onMouseDown={e => e.stopPropagation()}
            className="p-2 -mr-1 rounded-xl text-[#a1a1aa] hover:text-white hover:bg-white/10 active:bg-white/5 transition-all"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Row 2: Year — clearly separated, elegant control */}
        <div className="flex items-center justify-between mt-1.5 pt-2 border-t border-white/10 bg-white/[0.025] -mx-1 px-1 py-1 rounded">
          <button
            type="button"
            onClick={() => {
              const prev = new Date(displayMonth);
              prev.setFullYear(prev.getFullYear() - 1);
              goToMonth(prev);
            }}
            onMouseDown={e => e.stopPropagation()}
            className="p-2 -ml-1 rounded-xl text-[#a1a1aa] hover:text-[#c084fc] hover:bg-white/10 active:bg-white/5 transition-all"
            title="Previous year"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>

          <div className="relative">
            <select
              value={currentYear}
              onChange={(e) => {
                const newDate = new Date(displayMonth);
                newDate.setFullYear(Number(e.target.value));
                goToMonth(newDate);
              }}
              onMouseDown={e => e.stopPropagation()}
              className="appearance-none bg-white/5 border border-white/10 hover:border-[#c084fc] focus:border-[#c084fc] hover:text-[#c084fc] text-white text-sm font-medium rounded-xl pl-4 pr-8 py-1 cursor-pointer outline-none transition-all text-center min-w-[88px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]">
              <ChevronRight className="h-3 w-3 rotate-90" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = new Date(displayMonth);
              next.setFullYear(next.getFullYear() + 1);
              goToMonth(next);
            }}
            onMouseDown={e => e.stopPropagation()}
            className="p-2 -mr-1 rounded-xl text-[#a1a1aa] hover:text-[#c084fc] hover:bg-white/10 active:bg-white/5 transition-all"
            title="Next year"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Close on Escape key when open
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Compute anchored position below the trigger (top edge is fixed — only bottom grows/shrinks)
  const getPopoverStyle = () => {
    if (!anchorRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const margin = 8;
    const pickerWidth = 380;

    // Top is locked to just below the trigger
    let top = anchorRect.bottom + margin;
    let left = anchorRect.left;

    // Keep it from going off the right edge
    const maxLeft = window.innerWidth - pickerWidth - 16;
    if (left > maxLeft) {
      left = Math.max(16, anchorRect.right - pickerWidth);
    }
    if (left < 16) left = 16;

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 700,
    };
  };

  // The actual picker content (rendered via portal) — anchored below the trigger, top edge fixed
  const PickerContent = (
    <div
      className="fixed inset-0 z-[650] bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsOpen(false);
        }
      }}
    >
      <div
        ref={cardRef}
        style={getPopoverStyle()}
        className="glass-strong w-[380px] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[min(560px,85dvh)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 border-b border-white/10">
          <div className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Select date
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[#71717a] hover:text-white p-1.5 -mr-1.5 rounded-lg hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar area — grows/shrinks naturally downward only */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              handleSelect(date);
              if (date) setIsOpen(false);
            }}
            components={{ MonthCaption: ModernCaption }}
            showOutsideDays
            hideNavigation
            className="rdp-modal"
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              month_caption: "flex justify-center",
              nav: "hidden",
              month_grid: "w-full",
              weekdays: "grid grid-cols-7",
              weekday: "text-[#71717a] text-[10px] font-mono uppercase tracking-[0.5px] text-center pb-1.5",
              week: "grid grid-cols-7",
              day: "flex items-center justify-center p-0.5",
              day_button: "h-10 w-10 flex items-center justify-center text-[15px] rounded-2xl hover:bg-white/10 text-white transition-all active:scale-[0.94] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/60",
              selected: "",
              today: "",
              outside: "",
            }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-white/10 flex gap-2 bg-[rgba(17,17,20,0.55)]">
          <button
            type="button"
            onClick={goToToday}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5 text-[#a1a1aa] hover:text-white transition"
          >
            Today
          </button>
          <button
            type="button"
            onClick={clearDate}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5 text-[#a1a1aa] hover:text-white transition"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="text-[#71717a] mb-1.5 block text-xs flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="input w-full px-3 py-2 rounded-xl text-sm flex items-center justify-between text-left hover:border-white/20 transition-colors"
      >
        <span className={value ? "text-white" : "text-[#71717a]"}>
          {displayValue}
        </span>
        <Calendar className="h-4 w-4 text-[#a1a1aa]" />
      </button>

      {/* Portal popover — positioned near the trigger (or centered on very small screens) */}
      {isOpen && typeof window !== 'undefined' &&
        createPortal(PickerContent, document.body)
      }
    </div>
  );
}

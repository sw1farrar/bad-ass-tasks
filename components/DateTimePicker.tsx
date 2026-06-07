'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, startOfToday } from 'date-fns';
import { DayPicker, type MonthCaptionProps, useDayPicker } from 'react-day-picker';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate, toLocalDateString } from '@/lib/datetime';

interface DatePickerProps {
  value?: string;
  onChange: (dateString: string | undefined) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

const PANEL_WIDTH = 300;
const PANEL_HEIGHT_ESTIMATE = 380;
const COMPACT_BREAKPOINT = 640;

function useCompactViewport() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return compact;
}

const parseToLocalDate = parseLocalDate;
const toDateString = toLocalDateString;

function CompactCaption({
  calendarMonth,
  displayIndex: _displayIndex,
  className,
  style,
  ...rest
}: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  const displayMonth = calendarMonth?.date || new Date();

  const shiftYear = (delta: number) => {
    const next = new Date(displayMonth);
    next.setFullYear(next.getFullYear() + delta);
    goToMonth(next);
  };

  return (
    <div className={cn('px-1 pb-2', className)} style={style} {...rest}>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => previousMonth && goToMonth(previousMonth)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 w-8 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 mx-auto" />
        </button>

        <div className="flex-1 text-center min-w-0">
          <div className="text-sm font-semibold text-white tracking-tight truncate">
            {format(displayMonth, 'MMMM yyyy')}
          </div>
        </div>

        <button
          type="button"
          onClick={() => nextMonth && goToMonth(nextMonth)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 w-8 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 mx-auto" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1 mt-1">
        <button
          type="button"
          onClick={() => shiftYear(-1)}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#71717a] hover:text-[#c084fc] hover:bg-white/5 transition"
        >
          −1 yr
        </button>
        <button
          type="button"
          onClick={() => goToMonth(startOfToday())}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#71717a] hover:text-[#c084fc] hover:bg-white/5 transition"
        >
          This month
        </button>
        <button
          type="button"
          onClick={() => shiftYear(1)}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono text-[#71717a] hover:text-[#c084fc] hover:bg-white/5 transition"
        >
          +1 yr
        </button>
      </div>
    </div>
  );
}

function computePopoverPosition(anchor: DOMRect) {
  const margin = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - margin * 2);

  let top = anchor.bottom + margin;
  let left = anchor.left + anchor.width / 2 - width / 2;

  if (top + PANEL_HEIGHT_ESTIMATE > vh - margin) {
    top = anchor.top - PANEL_HEIGHT_ESTIMATE - margin;
  }
  if (top < margin) {
    top = Math.max(margin, (vh - PANEL_HEIGHT_ESTIMATE) / 2);
  }

  left = Math.min(Math.max(margin, left), vw - width - margin);

  return { top, left, width };
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'No date set',
  className,
  label,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const isCompact = useCompactViewport();

  const selectedDate = parseToLocalDate(value);

  const displayValue = value
    ? format(parseToLocalDate(value)!, 'MMM d, yyyy')
    : placeholder;

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const applyDate = useCallback(
    (date: Date | undefined, shouldClose = true) => {
      if (!date) {
        onChange(undefined);
      } else {
        onChange(toDateString(date));
      }
      if (shouldClose) close();
    },
    [onChange, close]
  );

  const openPicker = () => {
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    }
    setIsOpen(true);
  };

  const shortcuts = useMemo(() => {
    const today = startOfToday();
    return [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: addDays(today, 1) },
      { label: '+1 week', date: addDays(today, 7) },
    ];
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [isOpen, close]);

  const popoverStyle = !isCompact && anchorRect
    ? computePopoverPosition(anchorRect)
    : null;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose due date"
      className={cn(
        'date-picker-panel bg-[#0f0f12] border border-white/10 shadow-2xl flex flex-col overflow-hidden',
        isCompact
          ? 'fixed inset-x-0 bottom-0 z-[720] rounded-t-2xl max-h-[min(88dvh,520px)] pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'fixed z-[720] rounded-xl max-h-[min(85dvh,420px)]'
      )}
      style={
        !isCompact && popoverStyle
          ? {
              top: popoverStyle.top,
              left: popoverStyle.left,
              width: popoverStyle.width,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      {isCompact && (
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-xs font-medium text-[#a1a1aa] tracking-wide uppercase">
          Due date
        </span>
        <button
          type="button"
          onClick={close}
          className="h-7 w-7 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10 transition flex items-center justify-center"
          aria-label="Close date picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 py-2 flex gap-1.5 flex-wrap shrink-0 border-b border-white/5">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => applyDate(s.date)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/10 text-[#d4d4d8] hover:border-[#c084fc]/40 hover:bg-[#c084fc]/10 hover:text-white transition"
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyDate(undefined)}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-white/10 text-[#71717a] hover:border-[#ff3366]/30 hover:text-[#ff3366] transition"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(date) => applyDate(date)}
          components={{ MonthCaption: CompactCaption }}
          showOutsideDays
          hideNavigation
          className="rdp-compact mx-auto"
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-1',
            month_caption: 'flex justify-center',
            nav: 'hidden',
            month_grid: 'w-full',
            weekdays: 'grid grid-cols-7 mb-1',
            weekday:
              'text-[#71717a] text-[9px] font-mono uppercase tracking-wider text-center py-1',
            week: 'grid grid-cols-7',
            day: 'flex items-center justify-center p-0',
            day_button:
              'h-9 w-9 max-sm:h-10 max-sm:w-10 flex items-center justify-center text-[13px] rounded-lg hover:bg-white/10 active:scale-95 text-[#f4f4f5] transition cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/50',
            selected:
              '[&>button]:bg-[#c084fc] [&>button]:text-black [&>button]:font-semibold',
            today:
              '[&>button]:ring-1 [&>button]:ring-[#c084fc]/50 [&>button]:text-[#c084fc]',
            outside: '[&>button]:text-[#52525b]/60',
          }}
        />
      </div>

      {value && (
        <div className="px-3 py-2 border-t border-white/10 text-[11px] text-[#71717a] shrink-0">
          Selected: <span className="text-[#e4e4e7]">{displayValue}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="text-[#71717a] mb-1.5 block text-xs flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="input w-full px-3 py-2 rounded-xl text-sm flex items-center justify-between text-left hover:border-white/20 transition-colors min-h-[40px]"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-white' : 'text-[#71717a]'}>
          {displayValue}
        </span>
        <Calendar className="h-4 w-4 text-[#a1a1aa] shrink-0" />
      </button>

      {isOpen && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[710]">
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              onClick={close}
              aria-hidden
            />
            {panel}
          </div>,
          document.body
        )}
    </div>
  );
}
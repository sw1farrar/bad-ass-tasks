'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, startOfToday } from 'date-fns';
import { DayPicker, type MonthCaptionProps, useDayPicker } from 'react-day-picker';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate, safeFormatDate, toLocalDateString } from '@/lib/datetime';
import { useScrollLock } from '@/lib/hooks/useScrollLock';

interface DatePickerProps {
  value?: string | null;
  onChange: (dateString: string | undefined) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

const MOBILE_BREAKPOINT = 768;

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
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

  return (
    <div className={cn('px-1 pb-2', className)} style={style} {...rest}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => previousMonth && goToMonth(previousMonth)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-9 w-9 shrink-0 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 mx-auto" />
        </button>

        <div className="flex-1 text-center min-w-0 px-1">
          <div className="text-sm font-semibold text-white tracking-tight">
            {format(displayMonth, 'MMMM yyyy')}
          </div>
        </div>

        <button
          type="button"
          onClick={() => nextMonth && goToMonth(nextMonth)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-9 w-9 shrink-0 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 mx-auto" />
        </button>
      </div>
    </div>
  );
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
  const isMobile = useMobileViewport();

  const selectedDate = parseToLocalDate(value);

  const displayValue = selectedDate
    ? safeFormatDate(selectedDate, 'MMM d, yyyy', placeholder)
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
    [onChange, close],
  );

  const shortcuts = useMemo(() => {
    const today = startOfToday();
    return [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: addDays(today, 1) },
      { label: 'One week', date: addDays(today, 7) },
    ];
  }, []);

  useScrollLock(isOpen);

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

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [isOpen, close]);

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose due date"
      className={cn(
        'date-picker-panel bg-[#0f0f12] border border-white/10 shadow-2xl flex flex-col overflow-hidden',
        isMobile
          ? 'mobile-bottom-sheet fixed inset-x-0 bottom-0 z-[720] rounded-t-3xl h-[92dvh] max-h-[92dvh]'
          : 'date-picker-sheet-desktop fixed z-[720] rounded-2xl',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile && <div className="sheet-drag-handle shrink-0" aria-hidden="true" />}

      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm font-semibold text-[#f4f4f5] tracking-tight">Due date</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyDate(undefined)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#71717a] hover:text-[#ff3366] hover:bg-white/5 transition min-h-[36px]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={close}
            className="h-9 w-9 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10 transition flex items-center justify-center"
            aria-label="Close date picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        <DayPicker
          mode="single"
          required
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            applyDate(date);
          }}
          components={{
            MonthCaption: CompactCaption,
          }}
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

      <div
        className="shrink-0 px-4 py-3 flex gap-2 border-t border-white/10"
        style={
          isMobile
            ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 12px))' }
            : undefined
        }
      >
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => applyDate(s.date)}
            className="flex-1 min-h-[44px] rounded-xl text-sm font-medium border border-white/10 text-[#d4d4d8] hover:border-[#c084fc]/40 hover:bg-[#c084fc]/10 hover:text-white active:scale-[0.98] transition"
          >
            {s.label}
          </button>
        ))}
      </div>
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
        onClick={() => setIsOpen(true)}
        className="input w-full px-3 py-2 rounded-xl text-sm flex items-center justify-between text-left hover:border-white/20 transition-colors min-h-[40px]"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-white' : 'text-[#71717a]'}>{displayValue}</span>
        <Calendar className="h-4 w-4 text-[#a1a1aa] shrink-0" />
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[710]">
            <div
              className={cn(
                'absolute inset-0 date-picker-backdrop',
                isMobile ? 'sheet-backdrop' : undefined,
              )}
              onClick={close}
              aria-hidden
            />
            {panel}
          </div>,
          document.body,
        )}
    </div>
  );
}
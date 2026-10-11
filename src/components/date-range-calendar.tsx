"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
};
const brDate = (value: string) => (value ? value.split("-").reverse().join("/") : "—");

/**
 * Calendário de intervalo no tema do painel. Substitui os <input type="date">,
 * que abriam o calendário nativo (branco, fora do tema) por cima do botão Aplicar.
 */
export function DateRangeCalendar({
  start,
  end,
  onChange,
  onApply,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  onApply: () => void;
}) {
  const anchor = end || start || todayIso();
  const [view, setView] = useState(() => {
    const [y, m] = anchor.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const today = todayIso();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(view.year, view.month, i + 1)),
  ];

  const shift = (delta: number) =>
    setView((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  const pick = (day: string) => {
    if (!start || end) onChange(day, "");
    else if (day < start) onChange(day, "");
    else onChange(start, day);
  };

  return (
    <div className="range-cal">
      <div className="range-cal-head">
        <button type="button" className="range-cal-nav" onClick={() => shift(-1)} aria-label="Mês anterior">
          <ChevronLeft size={14} />
        </button>
        <strong>{MONTHS[view.month][0].toUpperCase() + MONTHS[view.month].slice(1)} de {view.year}</strong>
        <button type="button" className="range-cal-nav" onClick={() => shift(1)} aria-label="Próximo mês">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="range-cal-grid" role="grid">
        {WEEKDAYS.map((label, i) => (
          <span key={i} className="range-cal-weekday">{label}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = Boolean(start && end && day > start && day < end);
          return (
            <button
              key={day}
              type="button"
              className={[
                "range-cal-day",
                day === today ? "is-today" : "",
                isStart || isEnd ? "is-edge" : "",
                inRange ? "in-range" : "",
              ].join(" ")}
              onClick={() => pick(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="range-cal-summary">
        <span>{brDate(start)}</span>
        <span aria-hidden="true">→</span>
        <span>{brDate(end)}</span>
      </div>
      <button
        type="button"
        className="button primary small custom-date-apply"
        disabled={!start || !end}
        onClick={onApply}
      >
        Aplicar data
      </button>
    </div>
  );
}

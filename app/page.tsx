"use client";

import { useState, ChangeEvent, useRef, useEffect, useMemo } from "react";

const MAX_WORDS = 240;

const ENTRY_KEY_PREFIX = "twofourty-entry-";

const WEEKDAYS = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."] as const;
const MONTHS = [
  "Jan.",
  "Feb.",
  "Mär.",
  "Apr.",
  "Mai",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Okt.",
  "Nov.",
  "Dez.",
] as const;

function toIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(d: Date): string {
  const weekdayLabel = WEEKDAYS[d.getDay()];
  const day = String(d.getDate()).padStart(2, "0");
  const monthLabel = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${weekdayLabel} ${day}. ${monthLabel} ${year}`;
}

function formatMonthYear(d: Date): string {
  const monthLabel = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${monthLabel} ${year}`;
}

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

type HistoryEntry = {
  iso: string;
  label: string;
  isToday: boolean;
  hasEntry: boolean;
  preview: string;
  locked: boolean;
};

type CalendarDay = {
  iso: string;
  day: number;
  hasEntry: boolean;
  locked: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
};

export default function HomePage() {
  const today = useMemo(() => {
    const d = new Date();
    return {
      iso: toIso(d),
      label: formatDateLabel(d),
      monthYear: formatMonthYear(d),
    };
  }, []);

  const storageKey = useMemo(
    () => `${ENTRY_KEY_PREFIX}${today.iso}`,
    [today.iso]
  );

  const lockKey = useMemo(
    () => `${storageKey}-locked`,
    [storageKey]
  );

  const [text, setText] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<{
    iso: string;
    label: string;
    content: string;
    locked: boolean;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [activeDateIso, setActiveDateIso] = useState(today.iso);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());
  const hideCounterTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Migration: alte serene-Keys auf twofourty umziehen (ohne Datenverlust)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const oldPrefix = "serene-entry-";
    const newPrefix = ENTRY_KEY_PREFIX;

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(oldPrefix) && !key.endsWith("-locked")) {
        const value = window.localStorage.getItem(key);
        if (value === null) continue;

        const rest = key.substring(oldPrefix.length);
        const newKey = `${newPrefix}${rest}`;

        // Nur kopieren, wenn es noch keinen neuen Key gibt
        if (!window.localStorage.getItem(newKey)) {
          window.localStorage.setItem(newKey, value);
        }

        const oldLockKey = `${key}-locked`;
        const lockValue = window.localStorage.getItem(oldLockKey);
        if (lockValue !== null) {
          const newLockKey = `${newKey}-locked`;
          if (!window.localStorage.getItem(newLockKey)) {
            window.localStorage.setItem(newLockKey, lockValue);
          }
        }
      }
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;

    let currentStreak = 0;
    const d = new Date();

    while (true) {
      const iso = toIso(d);
      const key = `${ENTRY_KEY_PREFIX}${iso}`;

      const content = window.localStorage.getItem(key);
      const hasEntry = !!(content && content.trim().length > 0);

      if (!hasEntry) {
        break;
      }

      currentStreak += 1;
      d.setDate(d.getDate() - 1);
    }

    setStreak(currentStreak);
  }, [text, isLocked]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Fokus beim Laden automatisch auf das Textfeld setzen
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(storageKey);
    if (saved && saved.trim().length > 0) {
      setText(saved);
      // Wenn bereits Text existiert, Counter beim Start nicht anzeigen
      setShowCounter(false);
    }

    const locked = window.localStorage.getItem(lockKey);
    if (locked === "true") {
      setIsLocked(true);
    }
  }, [storageKey, lockKey]);

  useEffect(() => {
    return () => {
      if (hideCounterTimeoutRef.current) {
        clearTimeout(hideCounterTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Nur speichern, wenn wir wirklich den heutigen Tag bearbeiten
    if (activeDateIso !== today.iso) return;

    if (text.trim().length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, text);
  }, [text, storageKey, activeDateIso, today.iso]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const entries: HistoryEntry[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const iso = toIso(d);
      const label = formatDateLabel(d);

      const key = `${ENTRY_KEY_PREFIX}${iso}`;
      const keyLocked = `${key}-locked`;

      const content = window.localStorage.getItem(key);
      const locked = window.localStorage.getItem(keyLocked) === "true";

      const hasEntry = !!(content && content.trim().length > 0);

      let preview = "";
      if (hasEntry && content) {
        const words = content.trim().split(/\s+/);
        const previewWords = words.slice(0, 14);
        preview = previewWords.join(" ");
        if (words.length > previewWords.length) {
          preview += " …";
        }
      }

      entries.push({
        iso,
        label,
        isToday: i === 0,
        hasEntry,
        preview,
        locked,
      });
    }

    setHistory(entries);
  }, [text]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const base = currentMonthDate;
    const year = base.getFullYear();
    const monthIndex = base.getMonth();

    const month = String(monthIndex + 1).padStart(2, "0");

    const firstOfMonth = new Date(year, monthIndex, 1);
    const firstWeekday = firstOfMonth.getDay(); // 0 = So, 6 = Sa
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const days: CalendarDay[] = [];

    // Leere Zellen vor dem 1. des Monats
    for (let i = 0; i < firstWeekday; i++) {
      days.push({
        iso: `blank-${i}`,
        day: 0,
        hasEntry: false,
        locked: false,
        isToday: false,
        isCurrentMonth: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = String(dayNumber).padStart(2, "0");
      const iso = `${year}-${month}-${day}`;
      const key = `${ENTRY_KEY_PREFIX}${iso}`;
      const keyLocked = `${key}-locked`;

      const content = window.localStorage.getItem(key);
      const hasEntry = !!(content && content.trim().length > 0);
      const locked = window.localStorage.getItem(keyLocked) === "true";

      const isToday = iso === today.iso;

      days.push({
        iso,
        day: dayNumber,
        hasEntry,
        locked,
        isToday,
        isCurrentMonth: true,
      });
    }

    setCalendarDays(days);
  }, [currentMonthDate, today.iso, text, isLocked]);

  function handleSelectDay(day: CalendarDay) {
    if (!day.isCurrentMonth) {
      setSelectedDateIso(null);
      setSelectedEntry(null);
      return;
    }

    if (typeof window === "undefined") return;

    const key = `${ENTRY_KEY_PREFIX}${day.iso}`;
    const keyLocked = `${key}-locked`;
    const content = window.localStorage.getItem(key) || "";
    const locked = window.localStorage.getItem(keyLocked) === "true";

    const [yearStr, monthStr, dayStr] = day.iso.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const dayNumber = Number(dayStr);
    const d = new Date(year, monthIndex, dayNumber);

    const label = formatDateLabel(d);

    setActiveDateIso(day.iso);
    setSelectedDateIso(day.iso);
    setSelectedEntry({
      iso: day.iso,
      label,
      content,
      locked,
    });

    // Textfeld-Inhalt auf den Eintrag dieses Tages setzen (Viewer)
    setText(content);
  }

  const isViewingToday = activeDateIso === today.iso;
  const isFutureDay = !isViewingToday && activeDateIso > today.iso;
  const isPastDay = !isViewingToday && activeDateIso < today.iso;
  const hasActiveEntry = text.trim().length > 0;
  const wordCount = countWords(text);
  const progress = Math.min((wordCount / MAX_WORDS) * 100, 100);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    // Nur den heutigen Tag bearbeiten, vergangene Tage sind read-only
    if (!isViewingToday || isLocked) return;

    const input = e.target.value;

    const words = input.trim() === "" ? [] : input.trim().split(/\s+/);

    // Wenn kein Text mehr da ist, Counter ausblenden und Timeout zurücksetzen
    if (words.length === 0) {
      setText("");
      setShowCounter(false);
      if (hideCounterTimeoutRef.current) {
        clearTimeout(hideCounterTimeoutRef.current);
      }
      return;
    }

    // Wenn der neue Text über dem Limit wäre, hart begrenzen
    if (words.length > MAX_WORDS) {
      const limited = words.slice(0, MAX_WORDS).join(" ");
      setText(limited);
      return;
    }

    setText(input);

    // Beim Tippen Counter einblenden und Inaktivitäts-Timer neu setzen
    setShowCounter(true);
    if (hideCounterTimeoutRef.current) {
      clearTimeout(hideCounterTimeoutRef.current);
    }
    hideCounterTimeoutRef.current = setTimeout(() => {
      setShowCounter(false);
    }, 3000);
  }

  let placeholderText = "Schreib deinen heutigen Eintrag...";
  if (!isViewingToday) {
    if (isFutureDay) {
      placeholderText =
        "Dieser Tag liegt in der Zukunft. Du kannst hier noch nichts schreiben.";
    } else if (!hasActiveEntry) {
      placeholderText = "Für diesen Tag gibt es keinen Eintrag.";
    } else {
      placeholderText = "";
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-200 via-stone-300 to-stone-200 text-stone-900 flex flex-col font-[700] font-['Helvetica','Arial',sans-serif]">
      {/* Top-Bar – sehr minimal, wie bei Monkeytype */}
      <header className="w-full flex items-center justify-between px-8 pt-6 text-[10px] text-stone-600 tracking-[0.15em] font-bold normal-case">
        <span className="text-[14px] font-bold">twofourty</span>
        <span className="normal-case tracking-normal text-[11px] text-stone-500 font-normal">
          {today.label}
        </span>
      </header>

      {/* Center-Content – Fokusbereich */}
      <section
        className="relative flex-1 flex items-start justify-center px-8"
        onClick={() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }}
      >
        {/* Linke Sidebar: Kalender + Übersicht – absolut links unter dem Header */}
        <aside className="absolute left-8 top-24 w-64 flex flex-col gap-8">
          {/* Monat + Navigation */}
          <div className="flex items-center justify-between text-[13px] font-bold text-stone-800">
            <button
              type="button"
              onClick={() =>
                setCurrentMonthDate((prev) => {
                  const d = new Date(prev);
                  d.setMonth(d.getMonth() - 1);
                  return d;
                })
              }
              className="px-1 text-stone-500 hover:text-stone-800 transition-colors"
            >
              ‹
            </button>
            <span>{formatMonthYear(currentMonthDate)}</span>
            <button
              type="button"
              onClick={() =>
                setCurrentMonthDate((prev) => {
                  const d = new Date(prev);
                  d.setMonth(d.getMonth() + 1);
                  return d;
                })
              }
              className="px-1 text-stone-500 hover:text-stone-800 transition-colors"
            >
              ›
            </button>
          </div>

          {/* Kalender */}
          <div className="grid grid-cols-7 gap-1 text-[10px] text-stone-500">
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((d) => (
              <span key={d} className="text-center">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-stone-700 min-h-[9.5rem]">
            {calendarDays.map((day) =>
              !day.isCurrentMonth ? (
                <div key={day.iso} />
              ) : (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`
                    flex flex-col items-center justify-center py-1 rounded-md transition-colors
                    ${
                      day.hasEntry
                        ? "cursor-pointer hover:bg-stone-800 hover:text-stone-100"
                        : "cursor-default"
                    }
                    ${day.isToday ? "bg-stone-300 text-stone-900" : ""}
                    ${
                      selectedDateIso === day.iso
                        ? "ring-1 ring-stone-900"
                        : ""
                    }
                    ${day.locked ? "border border-stone-600/70" : ""}
                  `}
                >
                  <span>{day.day}</span>
                  {day.hasEntry && (
                    <span
                      className={`mt-0.5 h-1 w-1 rounded-full ${
                        day.locked ? "bg-stone-900" : "bg-stone-500"
                      }`}
                    />
                  )}
                </button>
              )
            )}
          </div>

          {/* History – letzte 7 Tage */}
          <div className="w-full pt-6 space-y-1 text-[11px] text-stone-600">
            {history.map((entry) => (
              <div
                key={entry.iso}
                className="flex items-baseline gap-2 pr-4"
              >
                <span
                  className={`uppercase tracking-[0.2em] ${
                    entry.isToday ? "text-stone-800" : "text-stone-600"
                  }`}
                >
                  {entry.isToday ? "today" : entry.label}
                </span>
                <span className="text-[11px] text-stone-500 truncate">
                  {entry.hasEntry ? entry.preview : "no entry"}
                </span>
              </div>
            ))}
          </div>

          {/* Selected Entry Anzeige */}
          {selectedEntry && (
            <div className="w-full pt-4 border-t border-stone-300/60">
              <div className="text-[11px] uppercase tracking-[0.2em] text-stone-600 mb-1">
                {selectedEntry.label}
                {selectedEntry.locked && " · locked"}
              </div>
              <p className="text-[13px] leading-relaxed text-stone-700 whitespace-pre-wrap">
                {selectedEntry.content}
              </p>
            </div>
          )}
        </aside>

        {/* Zentrale Editor-Spalte – wirklich mittig im Screen */}
        <div className="w-full max-w-3xl mt-24 flex flex-col items-center space-y-6">
          {/* Header-Block: Progress-Bar + daily entry */}
          <div className="w-full max-w-2xl space-y-2">
            {/* Progress-Bar sehr dünn, dezent */}
            <div className="w-full h-[2px] rounded-full bg-stone-300 overflow-hidden">
              <div
                className="h-full bg-stone-700 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Titelzeile + Wordcounter */}
            <div className="w-full flex items-center justify-between text-[11px] tracking-[0.12em] text-stone-600 normal-case font-bold">
              <span>daily entry</span>
              <span
                className={`transition-opacity duration-500 ${
                  showCounter && wordCount > 0 && !isLocked
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              >
                {wordCount} / {MAX_WORDS} words
              </span>
            </div>
          </div>

          {streak > 0 && (
            <div className="w-full max-w-2xl text-[10px] tracking-[0.16em] text-stone-500">
              {streak === 1 ? "1 day streak" : `${streak} day streak`}
            </div>
          )}
          {!isViewingToday && (
            <div className="w-full max-w-2xl text-[10px] text-stone-500">
              {isFutureDay
                ? "Zukünftiger Tag – du kannst hier noch nichts schreiben."
                : hasActiveEntry
                ? "Vergangener Eintrag – dieser Tag kann nicht mehr bearbeitet werden."
                : "An diesem Tag wurde kein Eintrag geschrieben."}
            </div>
          )}

          {/* Editor-Bereich */}
          <div className="w-full max-w-2xl">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              readOnly={!isViewingToday || isLocked}
              placeholder={placeholderText}
              spellCheck={false}
              autoCorrect="off"
              autoComplete="off"
              autoCapitalize="off"
              className="
                w-full
                min-h-[260px]
                bg-transparent
                outline-none
                border-0
                text-2xl
                leading-relaxed
                tracking-[0.03em]
                resize-none
                text-stone-800
                placeholder:text-stone-500
              "
            />
          </div>

          {/* Lock-in Button / Status */}
          <div className="w-full max-w-2xl flex items-center justify-between text-[11px] text-stone-500">
            {isViewingToday ? (
              isLocked ? (
                <span className="uppercase tracking-[0.2em] text-stone-600">
                  entry locked for today
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (text.trim().length === 0) return;
                    setIsLocked(true);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(lockKey, "true");
                    }
                    setShowCounter(false);
                  }}
                  disabled={text.trim().length === 0}
                  className="ml-auto uppercase tracking-[0.25em] text-[10px] px-3 py-1 border border-stone-400 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-800 hover:text-stone-100 hover:border-stone-700 transition-colors"
                >
                  lock in today
                </button>
              )
            ) : (
              <span className="tracking-[0.16em] text-[10px] uppercase text-stone-600">
                viewing{" "}
                {selectedEntry?.label ?? activeDateIso}
                {selectedEntry?.locked ? " · locked" : ""}
                {selectedEntry && !selectedEntry.locked && selectedEntry.content.trim().length === 0
                  ? " · no entry"
                  : ""}
              </span>
            )}
          </div>

          {/* Hinweis bei Limit */}
          {wordCount >= MAX_WORDS && (
            <p className="w-full max-w-2xl text-[11px] text-red-600">
              Wortlimit erreicht. Mehr geht heute nicht.
            </p>
          )}
        </div>
      </section>

      {/* Optionaler Bottom-Space, damit es nicht hart endet */}
      <footer className="h-10" />
    </main>
  );
}

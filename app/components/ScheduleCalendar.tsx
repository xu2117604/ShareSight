"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ScheduleNote = {
  id: number;
  date: string;
  content: string;
  createdByPhone: string;
  createdByName: string;
  createdAt: string;
};

const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calendarDays(month: Date) {
  const first = firstOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

export default function ScheduleCalendar() {
  const today = useMemo(() => new Date(), []);
  const [displayedMonth, setDisplayedMonth] = useState(() => firstOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(today));
  const [notes, setNotes] = useState<ScheduleNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/schedule?month=${monthKey(displayedMonth)}`, { signal });
      const result = (await response.json()) as { notes?: ScheduleNote[]; error?: string };
      if (!response.ok) throw new Error(result.error || "读取日程失败");
      setNotes(result.notes ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "读取日程失败");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [displayedMonth]);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotes(controller.signal);
    return () => controller.abort();
  }, [loadNotes]);

  const notesByDate = useMemo(() => {
    const grouped = new Map<string, ScheduleNote[]>();
    notes.forEach((note) => grouped.set(note.date, [...(grouped.get(note.date) ?? []), note]));
    return grouped;
  }, [notes]);

  const days = useMemo(() => calendarDays(displayedMonth), [displayedMonth]);
  const selectedNotes = notesByDate.get(selectedDate) ?? [];

  function selectDay(day: Date) {
    if (day.getMonth() !== displayedMonth.getMonth() || day.getFullYear() !== displayedMonth.getFullYear()) {
      setDisplayedMonth(firstOfMonth(day));
    }
    setSelectedDate(dateKey(day));
    setDraft("");
    setError("");
  }

  function changeMonth(offset: number) {
    const next = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + offset, 1);
    setDisplayedMonth(next);
    setSelectedDate(dateKey(next));
    setDraft("");
  }

  function returnToToday() {
    setDisplayedMonth(firstOfMonth(today));
    setSelectedDate(dateKey(today));
    setDraft("");
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, content }),
      });
      const result = (await response.json()) as { note?: ScheduleNote; error?: string };
      if (!response.ok || !result.note) throw new Error(result.error || "添加日程失败");
      setNotes((current) => [...current, result.note as ScheduleNote]);
      setDraft("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "添加日程失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note: ScheduleNote) {
    if (!window.confirm(`确定删除“${note.content}”吗？`)) return;
    setError("");
    try {
      const response = await fetch(`/api/schedule/${note.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "删除日程失败");
      setNotes((current) => current.filter((item) => item.id !== note.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除日程失败");
    }
  }

  return (
    <section className="schedule-calendar" aria-label="组会日程">
      <div className="schedule-heading">
        <div>
          <p className="eyebrow">TEAM SCHEDULE</p>
          <h2>{displayedMonth.getFullYear()}年 {displayedMonth.getMonth() + 1}月</h2>
          <p>点击日期查看或添加当天的汇报安排</p>
        </div>
        <div className="schedule-navigation">
          <button type="button" aria-label="上一个月" onClick={() => changeMonth(-1)}>‹</button>
          <button type="button" className="today-button" onClick={returnToToday}>今天</button>
          <button type="button" aria-label="下一个月" onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <div className="schedule-layout">
        <div className="calendar-board" aria-busy={loading}>
          <div className="calendar-weekdays" aria-hidden="true">
            {weekDays.map((day) => <span key={day}>周{day}</span>)}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const key = dateKey(day);
              const dayNotes = notesByDate.get(key) ?? [];
              const outside = day.getMonth() !== displayedMonth.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={`calendar-day${outside ? " outside" : ""}${key === selectedDate ? " selected" : ""}${key === dateKey(today) ? " today" : ""}`}
                  aria-label={`${key}，${dayNotes.length}条日程`}
                  onClick={() => selectDay(day)}
                >
                  <span className="day-number">{day.getDate()}</span>
                  <span className="day-notes">
                    {dayNotes.slice(0, 2).map((note) => <span key={note.id}>{note.content}</span>)}
                    {dayNotes.length > 2 && <em>还有 {dayNotes.length - 2} 条</em>}
                  </span>
                </button>
              );
            })}
          </div>
          {loading && <div className="calendar-loading">正在同步日程…</div>}
        </div>

        <aside className="schedule-details">
          <div className="selected-date-heading">
            <span>{Number(selectedDate.slice(8))}</span>
            <div><strong>{selectedDate.slice(0, 7).replace("-", "年")}月</strong><small>当天安排</small></div>
          </div>
          <div className="selected-note-list">
            {selectedNotes.length === 0 ? (
              <p className="schedule-empty">当天还没有安排，可以在下方添加。</p>
            ) : selectedNotes.map((note) => (
              <article key={note.id}>
                <div>
                  <strong>{note.content}</strong>
                  <span>{note.createdByName} 添加</span>
                </div>
                <button type="button" aria-label={`删除${note.content}`} onClick={() => deleteNote(note)}>×</button>
              </article>
            ))}
          </div>
          <form className="schedule-form" onSubmit={addNote}>
            <label htmlFor="schedule-note">添加备注</label>
            <textarea
              id="schedule-note"
              maxLength={200}
              rows={3}
              value={draft}
              placeholder="例如：张三汇报项目进展"
              onChange={(event) => setDraft(event.target.value)}
            />
            <div><span>{draft.length}/200</span><button className="primary-button compact" disabled={saving || !draft.trim()}>{saving ? "添加中…" : "添加"}</button></div>
          </form>
          {error && <p className="schedule-error">{error}</p>}
        </aside>
      </div>
    </section>
  );
}

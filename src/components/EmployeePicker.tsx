"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn, normalizeForSearch } from "@/lib/utils";

export interface PickableEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface EmployeePickerProps {
  employees: PickableEmployee[];
  /** Form field name that carries the chosen employee id. */
  name?: string;
  placeholder?: string;
  className?: string;
  /**
   * Told whenever the picked employee changes, so a caller can react to it
   * (e.g. show that employee's remaining cash-advance limit). Reports null
   * when the choice is cleared or typed over.
   */
  onSelect?: (employee: PickableEmployee | null) => void;
}

/** Rows rendered before the list starts scrolling, so a big roster stays usable. */
const MAX_RESULTS = 50;

/**
 * Drops in wherever a form used `<select name="employeeId">`, but you find the
 * person by typing instead of scrolling a long list. The chosen id lives in a
 * hidden input under `name`, so the form reads it through FormData exactly as
 * it did before. Nothing is submitted until a row is actually picked — a
 * half-typed name leaves the field empty, and the form rejects it.
 */
export default function EmployeePicker({
  employees,
  name = "employeeId",
  placeholder = "Search employee by name or number…",
  className,
  onSelect,
}: EmployeePickerProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PickableEmployee | null>(null);
  const [open, setOpen] = useState(false);
  // null means "nothing highlighted", which keeps a stray Enter from silently
  // marking the wrong person — Enter only picks a row the user arrowed to.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const labelFor = (employee: PickableEmployee) =>
    `${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}`;

  // Word by word, so "cruz juan" and "juan cruz" both find the same person.
  const matches = useMemo(() => {
    const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
    if (!words.length) return employees;
    return employees.filter((employee) => {
      const haystack = normalizeForSearch(
        `${employee.firstName} ${employee.lastName} ${employee.employeeNumber}`
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [employees, query]);

  const visible = matches.slice(0, MAX_RESULTS);

  // Close when clicking elsewhere, so the list never lingers over the form.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long roster.
  useEffect(() => {
    if (!open || activeIndex === null) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const choose = (employee: PickableEmployee) => {
    setSelected(employee);
    setQuery(labelFor(employee));
    setOpen(false);
    setActiveIndex(null);
    onSelect?.(employee);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setActiveIndex(null);
    setOpen(true);
    onSelect?.(null);
    inputRef.current?.focus();
  };

  const handleChange = (value: string) => {
    setQuery(value);
    // Typing invalidates the previous choice — otherwise a half-typed name
    // would still submit the employee picked a moment ago.
    setSelected(null);
    setActiveIndex(null);
    setOpen(true);
    onSelect?.(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!visible.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => {
        const next = (prev ?? (step === 1 ? -1 : 0)) + step;
        return (next + visible.length) % visible.length;
      });
      return;
    }

    if (event.key === "Enter") {
      // Enter with no row highlighted falls through so the form submits and
      // its own validation reports the missing employee.
      if (open && activeIndex !== null && visible[activeIndex]) {
        event.preventDefault();
        choose(visible[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(null);
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search employee"
          aria-activedescendant={
            open && activeIndex !== null && visible[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-9 pr-11 py-3 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear employee"
            className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-sm text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matching employee</li>
          ) : (
            visible.map((employee, index) => (
              <li
                key={employee.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected?.id === employee.id}
                data-active={index === activeIndex}
                // Keep focus in the input so the click lands before a blur closes the list.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(employee)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === activeIndex ? "bg-blue-50" : "hover:bg-slate-50"
                )}
              >
                <p className="font-medium text-slate-900">
                  {employee.firstName} {employee.lastName}
                </p>
                <p className="text-xs text-slate-500">{employee.employeeNumber}</p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { normaliserTidInput } from "@/lib/utils/tid";

type TidInput24Props = {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
  ariaLabel?: string;
};

/** Tidfelt som alltid viser og lagrer 24-timers format (HH:mm). */
export default function TidInput24({
  value,
  onChange,
  className,
  ariaLabel,
}: TidInput24Props) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  function commit(raw: string) {
    if (!raw.trim()) {
      onChange(undefined);
      setDraft("");
      return;
    }
    const norm = normaliserTidInput(raw);
    if (norm) {
      onChange(norm);
      setDraft(norm);
      return;
    }
    setDraft(value ?? "");
  }

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      placeholder="tt:mm"
      title="24-timers format, f.eks. 07:30"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
    />
  );
}

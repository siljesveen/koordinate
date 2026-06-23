"use client";

import type { PointerEvent } from "react";
import styles from "./page.module.css";

type Props = {
  direction: "column" | "row";
  label: string;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
};

export default function PlanResizeHandle({ direction, label, onPointerDown }: Props) {
  return (
    <div
      role="separator"
      aria-orientation={direction === "column" ? "vertical" : "horizontal"}
      aria-label={label}
      className={
        direction === "column" ? styles.resizeHandleColumn : styles.resizeHandleRow
      }
      onPointerDown={onPointerDown}
    />
  );
}

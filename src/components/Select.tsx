import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../css/app.module.scss";
import { CheckCircleIcon, ChevronDownIcon } from "./icons";

type PortalHost = { createPortal?: typeof import("react-dom").createPortal };

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name for the trigger. */
  ariaLabel: string;
  /** Compact variant used inside panel headers. */
  size?: "default" | "small";
  className?: string;
};

/**
 * Styled dropdown replacing native `<select>`.
 *
 * Native selects cannot be themed consistently in an embedded webview (the
 * option list is drawn by the OS) and looked inconsistent with the rest of the
 * UI. This component renders a trigger plus a themed listbox popover.
 */
export function Select({ value, options, onChange, ariaLabel, size = "default", className }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId().replace(/:/g, "");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  // The popover is portalled to <body>, so it must be tracked separately from
  // the trigger wrapper when deciding whether a pointer press is "outside".
  const menuRef = useRef<HTMLUListElement | null>(null);
  const portalHost =
    typeof window !== "undefined" ? (window.Spicetify?.ReactDOM as PortalHost | undefined) : undefined;

  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  // Measure the trigger so the portalled popover sits directly under it.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // The popover hugs its label, never narrower than the trigger, and is
    // clamped to the viewport so it cannot run off-screen.
    const menuWidth = Math.min(200, Math.max(rect.width, 120));
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setMenuPosition({ top: rect.bottom + 6, left, width: menuWidth });
  }, [open, size]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => document.removeEventListener("mousedown", onPointerDown, true);
  }, [open, selectedIndex]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + delta)));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  const triggerClass =
    size === "small" ? `${styles.selectTrigger} ${styles.selectTriggerSmall}` : styles.selectTrigger;

  return (
    <div
      className={[styles.selectRoot, className].filter(Boolean).join(" ")}
      ref={rootRef}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClass} ${open ? styles.selectTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.selectValue}>{selected?.label ?? ""}</span>
        <ChevronDownIcon className={styles.selectChevron} />
      </button>

      {open &&
        (portalHost?.createPortal ?? ((node) => node))(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className={`${styles.selectMenu} ${size === "small" ? styles.selectMenuSmall : ""}`}
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.width,
              maxWidth: Math.min(200, window.innerWidth - menuPosition.left - 8),
            }}
          >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.selectOption} ${isActive ? styles.selectOptionActive : ""} ${
                    isSelected ? styles.selectOptionSelected : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  <span>{option.label}</span>
                  {isSelected && <CheckCircleIcon className={styles.selectCheck} />}
                </button>
              </li>
            );
          })}
          </ul>,
          document.body
        )}
    </div>
  );
}

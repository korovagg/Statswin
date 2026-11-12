import { RefObject, useEffect, useState } from "react";

type Size = { width: number; height: number };

/**
 * Observes the rendered size of an element.
 *
 * Used by the chart so bar geometry reacts to both width and height changes.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, fallback: Size = { width: 640, height: 240 }): Size {
  const [size, setSize] = useState<Size>(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width || fallback.width, height: rect.height || fallback.height });
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({
        width: width > 0 ? Math.floor(width) : fallback.width,
        height: height > 0 ? Math.floor(height) : fallback.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fallback.width, fallback.height]);

  return size;
}

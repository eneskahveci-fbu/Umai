/* Tiny helper that wires up:
   - ESC key → close
   - Tab / Shift-Tab → trapped inside the modal
   Use it from any dialog component:

     const ref = useRef<HTMLDivElement>(null);
     useModalA11y(ref, isOpen, onClose);

   Returns nothing; safe to call when isOpen is false (it just no-ops). */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useModalA11y(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  /* Keep onClose in a ref so the effect below doesn't need it as a dep.
     Without this, a new arrow-function prop every render re-fires the
     effect, resetting the 30ms focus timer and stealing focus mid-typing. */
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    const root = ref.current;
    /* Save the element that triggered the modal so we can restore focus on
       close — a real focus-trap fundamental. */
    const previouslyFocused = document.activeElement as HTMLElement | null;

    /* Focus the first focusable inside the modal on next tick */
    const t = window.setTimeout(() => {
      const first = root?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ref]);
}

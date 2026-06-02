import { useEffect } from "react";

/**
 * Scroll to + briefly highlight a DOM element identified by a URL query param,
 * e.g. ?task=network:vpn focuses #task-network:vpn. Used by status-update
 * email deep links so a recipient lands directly on the referenced item.
 *
 * Retries for a few seconds so it works even while the list is still loading.
 */
export function useFocusFromQuery(param: string, idPrefix: string) {
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get(param);
    if (!value) return;
    const targetId = `${idPrefix}-${value}`;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const ring = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-md"];
    const tick = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("transition-all", ...ring);
        setTimeout(() => el.classList.remove(...ring), 2800);
        return;
      }
      if (tries++ < 24) timer = setTimeout(tick, 150);
    };
    tick();
    return () => clearTimeout(timer);
  }, [param, idPrefix]);
}

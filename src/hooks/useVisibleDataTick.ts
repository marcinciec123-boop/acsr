import { useEffect, useRef, useState } from "react";

/**
 * Licznik odświeżeń dla paneli keep-alive: zdarzenia danych podbijają licznik
 * tylko gdy panel jest widoczny. Ukryty panel zapamiętuje zmianę i przelicza
 * się raz, gdy znów stanie się widoczny — bez ciężkich obliczeń w tle.
 */
export function useVisibleDataTick<T extends HTMLElement>(events: string[]) {
  const ref = useRef<T>(null);
  const [tick, setTick] = useState(0);
  const key = events.join("|");
  useEffect(() => {
    let visible = true;
    let dirty = false;
    const bump = () => {
      if (visible) setTick(t => t + 1); else dirty = true;
    };
    const list = key.split("|");
    list.forEach(e => window.addEventListener(e, bump));
    let observer: IntersectionObserver | undefined;
    if (ref.current && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(entries => {
        // display:none daje zerowy prostokąt; przewinięcie poza ekran nie usypia panelu.
        const rect = entries[entries.length - 1].boundingClientRect;
        visible = rect.width > 0 || rect.height > 0;
        if (visible && dirty) { dirty = false; setTick(t => t + 1); }
      });
      observer.observe(ref.current);
    }
    return () => { list.forEach(e => window.removeEventListener(e, bump)); observer?.disconnect(); };
  }, [key]);
  return [tick, ref] as const;
}

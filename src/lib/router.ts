import { useEffect, useState } from "react";

// Hash routes (#/pushups/stats) work on GitHub Pages with no server config, and
// let a notification open a specific screen, e.g. #/crew/<friend id>.
const parse = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (...parts: string[]) => {
  window.location.hash = "/" + parts.map(encodeURIComponent).join("/");
};

export const href = (...parts: string[]) => "#/" + parts.map(encodeURIComponent).join("/");

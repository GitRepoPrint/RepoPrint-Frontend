import { useEffect, useState } from "react";

/** true só depois da hidratação; evita hydration mismatch com valores que dependem do browser. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

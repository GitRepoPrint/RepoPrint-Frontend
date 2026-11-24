import { useEffect, useState } from "react";

/** true só depois da hidratação; evita hydration mismatch com valores que dependem do browser. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

import { useCallback, useRef, useState } from "react";

const TOAST_DURATION = 3000;

export function useToast() {
  const [toast, setToast] = useState("");
  const timerRef = useRef(null);

  const showToast = useCallback((message) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = setTimeout(() => {
      setToast("");
      timerRef.current = null;
    }, TOAST_DURATION);
  }, []);

  const clearToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast("");
    timerRef.current = null;
  }, []);

  return { toast, showToast, clearToast };
}

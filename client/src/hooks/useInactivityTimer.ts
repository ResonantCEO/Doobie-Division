import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const INACTIVE_TIMEOUT = 15 * 60 * 1000;
const WARNING_BEFORE = 2 * 60 * 1000;
const WARNING_AT = INACTIVE_TIMEOUT - WARNING_BEFORE;

interface UseInactivityTimerOptions {
  enabled: boolean;
  onLogout: () => void;
}

export function useInactivityTimer({ enabled, onLogout }: UseInactivityTimerOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_BEFORE / 1000);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setSecondsLeft(WARNING_BEFORE / 1000);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    clearAllTimers();
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, WARNING_AT);

    logoutTimerRef.current = setTimeout(() => {
      setShowWarning(false);
      onLogout();
    }, INACTIVE_TIMEOUT);
  }, [enabled, clearAllTimers, startCountdown, onLogout]);

  const stayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) return;

    resetTimer();

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [enabled, resetTimer, clearAllTimers]);

  return { showWarning, secondsLeft, stayLoggedIn };
}

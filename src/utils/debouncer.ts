import { useCallback, useEffect, useRef } from 'react';

export const createDebouncer = (timeout: number) => {
  let timer: NodeJS.Timeout | undefined;
  const debouncer = (func: () => void) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(func, timeout);
  };
  return debouncer;
};

export const useDebouncer = (timeout: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();

  const clearTimeout = () => window.clearTimeout(timeoutRef.current);
  useEffect(() => clearTimeout, []);

  const debouncer = useCallback(
    (func: () => void) => {
      clearTimeout();
      timeoutRef.current = setTimeout(func, timeout);
    },
    [timeout]
  );

  return debouncer;
};

export const createKeyDebouncer = (timeout: number) => {
  const dictionary: Record<string, NodeJS.Timeout> = {};

  const debouncer = (key: string, fn: () => void) => {
    if (dictionary[key]) clearTimeout(dictionary[key]);
    dictionary[key] = setTimeout(() => {
      fn();
      delete dictionary[key];
    }, timeout);
  };

  return debouncer;
};

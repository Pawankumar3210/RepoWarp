export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
  flush: (...args: Args) => void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const wrapped = (...args: Args) => {
    pendingArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pendingArgs) {
        const current = pendingArgs;
        pendingArgs = null;
        fn(...current);
      }
    }, delay);
  };

  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  wrapped.flush = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
    fn(...args);
  };

  return wrapped;
}

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface ScrollChromeContextValue {
  isScrollChromeHidden: boolean;
  setScrollChromeHidden: (hidden: boolean) => void;
}

const ScrollChromeContext = createContext<ScrollChromeContextValue>({
  isScrollChromeHidden: false,
  setScrollChromeHidden: () => {},
});

export function ScrollChromeProvider({ children }: { children: ReactNode }) {
  const [isScrollChromeHidden, setIsScrollChromeHidden] = useState(false);

  const setScrollChromeHidden = useCallback((hidden: boolean) => {
    setIsScrollChromeHidden((current) => (current === hidden ? current : hidden));
  }, []);

  const value = useMemo(
    () => ({ isScrollChromeHidden, setScrollChromeHidden }),
    [isScrollChromeHidden, setScrollChromeHidden],
  );

  return <ScrollChromeContext.Provider value={value}>{children}</ScrollChromeContext.Provider>;
}

export function useScrollChrome() {
  return useContext(ScrollChromeContext);
}

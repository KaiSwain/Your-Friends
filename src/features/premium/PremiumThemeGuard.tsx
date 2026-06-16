import { ReactNode, useEffect } from 'react';

import { useTheme } from '../theme/ThemeContext';
import { usePremium } from './PremiumContext';

/** Keeps free users off the custom app theme if premium expires or was never unlocked. */
export function PremiumThemeGuard({ children }: { children: ReactNode }) {
  const { hasTheme } = usePremium();
  const { themeName, setThemeName } = useTheme();

  useEffect(() => {
    if (themeName === 'custom' && !hasTheme('custom')) {
      setThemeName('yourFriends');
    }
  }, [hasTheme, setThemeName, themeName]);

  return children;
}

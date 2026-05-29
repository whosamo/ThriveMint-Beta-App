import React, { createContext, useContext, useState, useCallback } from 'react';
import { BriefMatchContext } from '../types/brief';

interface BriefContextValue {
  activeBriefMatch: BriefMatchContext | null;
  setActiveBriefMatch: (brief: BriefMatchContext | null) => void;
  clearBriefMatch: () => void;
}

const BriefContext = createContext<BriefContextValue>({
  activeBriefMatch: null,
  setActiveBriefMatch: () => {},
  clearBriefMatch: () => {},
});

export function BriefProvider({ children }: { children: React.ReactNode }) {
  const [activeBriefMatch, setActiveBriefMatch] = useState<BriefMatchContext | null>(null);

  const clearBriefMatch = useCallback(() => setActiveBriefMatch(null), []);

  return (
    <BriefContext.Provider value={{ activeBriefMatch, setActiveBriefMatch, clearBriefMatch }}>
      {children}
    </BriefContext.Provider>
  );
}

export function useBriefContext() {
  return useContext(BriefContext);
}

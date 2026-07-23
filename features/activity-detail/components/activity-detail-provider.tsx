"use client";

import React, { createContext, useContext, useState } from 'react';
import { AppIcon } from '@/components/ui/icon/app-icon';

type ActivityDetailContextType = {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  openActivityDetail: (target: string | { readonly kind: string; readonly id: string }) => void;
};

const ActivityDetailContext = createContext<ActivityDetailContextType | undefined>(undefined);

export function ActivityDetailProvider({ children }: { readonly children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const openActivityDetail = (target: string | { readonly kind: string; readonly id: string }) => {
    if (typeof target === 'string') {
      setActiveId(target);
    } else {
      setActiveId(target.id);
    }
  };
  return (
    <ActivityDetailContext.Provider value={{ activeId, setActiveId, openActivityDetail }}>
      {children}
    </ActivityDetailContext.Provider>
  );
}

export function useActivityDetail() {
  const ctx = useContext(ActivityDetailContext);
  if (!ctx) throw new Error('useActivityDetail must be used within ActivityDetailProvider');
  return ctx;
}

export function ActivityDetailChevron({ className }: { readonly className?: string }) {
  return <AppIcon name="chevron_right" className={className} />;
}

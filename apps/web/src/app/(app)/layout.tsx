import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

/** Coque des écrans connectés : sidebar sur bureau, barre du bas sur mobile. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

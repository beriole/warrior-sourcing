'use client';

import { uiEnter, spring } from '@ws/ui';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import {
  Bookmark,
  BookOpen,
  Boxes,
  Calculator,
  Compass,
  CreditCard,
  Factory,
  HelpCircle,
  Home,
  LifeBuoy,
  MapPin,
  MessageSquare,
  Search,
  Settings,
  Ship,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Sidebar bureau (§49). */
const SIDEBAR: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/tableau-de-bord', label: 'Accueil', icon: Home },
  { href: '/recherche', label: 'Recherche', icon: Search },
  { href: '/opportunites', label: 'Opportunités', icon: Boxes },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: Factory },
  { href: '/importations', label: 'Importations', icon: Ship },
  { href: '/expedition', label: 'Adresse d’expédition', icon: MapPin },
  { href: '/business-lab', label: 'Business Lab', icon: TrendingUp },
  { href: '/academy', label: 'Academy', icon: BookOpen },
  { href: '/services', label: 'Services', icon: LifeBuoy },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
];

const SIDEBAR_BOTTOM: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/abonnement', label: 'Abonnement', icon: CreditCard },
  { href: '/favoris', label: 'Favoris', icon: Bookmark },
  { href: '/aide', label: 'Aide', icon: HelpCircle },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
  { href: '/profil', label: 'Profil', icon: User },
];

/** Barre du bas mobile, limitée à cinq entrées pour préserver la clarté (§48). */
const BOTTOM_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/tableau-de-bord', label: 'Accueil', icon: Home },
  { href: '/opportunites', label: 'Explorer', icon: Compass },
  { href: '/calculateur', label: 'Importer', icon: Calculator },
  { href: '/academy', label: 'Academy', icon: BookOpen },
  { href: '/profil', label: 'Profil', icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduit = useReducedMotion();
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-charcoal p-3 text-white md:flex">
        <Link href="/tableau-de-bord" className="px-3 py-3 font-display text-base font-bold tracking-tight">
          Warrior <span className="text-gold">Sourcing</span>
        </Link>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5">
          {SIDEBAR.map((item) => (
            <SidebarLink key={item.href} {...item} current={isCurrent(item.href)} reduit={reduit} />
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-white/10 pt-2">
          {SIDEBAR_BOTTOM.map((item) => (
            <SidebarLink key={item.href} {...item} current={isCurrent(item.href)} reduit={reduit} />
          ))}
        </div>
      </aside>

      {/* Marge basse mobile : la barre de navigation ne doit jamais masquer le contenu. */}
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {/*
          La barre du bas mobile est limitée à cinq entrées (§48) et la recherche n'y tient
          pas. Elle est donc posée en tête de contenu sur mobile : sans elle, le public
          principal de la plateforme n'aurait aucun accès à la recherche globale.
        */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <Link
            href="/recherche"
            className="flex min-h-11 flex-1 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-sm text-muted-foreground"
          >
            <Search className="size-4" aria-hidden />
            Chercher un produit, un fournisseur…
          </Link>
          <Link
            href="/favoris"
            aria-label="Mes favoris"
            className="inline-flex size-11 items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            <Bookmark className="size-5" aria-hidden />
          </Link>
        </div>
        {/*
         * Transition entre pages : le contenu sortant dégage plus vite qu'il n'entre,
         * et le déplacement reste court. Une navigation interne n'est pas un film :
         * elle confirme qu'on a changé d'endroit, puis elle s'efface.
         */}
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={pathname}
            variants={reduit ? undefined : uiEnter}
            initial="hidden"
            animate="shown"
            exit={reduit ? undefined : { opacity: 0, y: -6, transition: { duration: 0.12 } }}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </div>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? 'page' : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                current ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {/* Le liseré actif glisse d'un onglet à l'autre au lieu de clignoter. */}
              {current && !reduit && (
                <m.span
                  layoutId="onglet-actif"
                  className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
                  transition={spring.ui}
                />
              )}
              {current && reduit && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
              <m.span
                animate={reduit ? undefined : { scale: current ? 1.08 : 1, y: current ? -1 : 0 }}
                transition={spring.ui}
              >
                <Icon className="size-5" aria-hidden />
              </m.span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  current,
  reduit,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  reduit: boolean | null;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        current ? 'text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
      }`}
    >
      {/* Le fond actif est un élément unique partagé : il se déplace, il ne réapparaît pas. */}
      {current &&
        (reduit ? (
          <span className="absolute inset-0 rounded-md bg-imperial" />
        ) : (
          <m.span layoutId="sidebar-actif" className="absolute inset-0 rounded-md bg-imperial" transition={spring.ui} />
        ))}
      <Icon className="relative size-4" aria-hidden />
      <span className="relative">{label}</span>
    </Link>
  );
}

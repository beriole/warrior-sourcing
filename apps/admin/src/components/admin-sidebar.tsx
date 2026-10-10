'use client';

import {
  BookOpen,
  Boxes,
  Factory,
  LayoutDashboard,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  ReceiptText,
  Settings,
  Tag,
  Ship,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sections du back-office (§37, §38). Les droits sont vérifiés par l'API, pas par ce menu.
 * Une entrée sans écran livré pointe vers sa future adresse : l'API répond déjà, l'écran suit.
 */
const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/produits', label: 'Produits', icon: Boxes },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: Factory },
  { href: '/cargo', label: 'Transitaires et tarifs', icon: Truck },
  { href: '/commandes', label: 'Commandes', icon: ReceiptText },
  { href: '/logistique', label: 'Logistique', icon: Ship },
  { href: '/paiements', label: 'Paiements', icon: Wallet },
  { href: '/formations', label: 'Formations', icon: BookOpen },
  { href: '/offres', label: 'Offres et abonnements', icon: CreditCard },
  { href: '/promotions', label: 'Promotions', icon: Tag },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: Users },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/tickets', label: 'Tickets', icon: LifeBuoy },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-charcoal p-3 text-white md:flex">
      <span className="px-3 py-3 text-base font-bold">
        Warrior <span className="text-gold">Admin</span>
      </span>
      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent(href) ? 'page' : undefined}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white aria-[current=page]:bg-imperial aria-[current=page]:text-white"
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/parametres" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5">
        <Settings className="size-4" aria-hidden />
        Paramètres
      </Link>
    </aside>
  );
}

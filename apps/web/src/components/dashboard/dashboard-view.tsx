'use client';

import { formatMoney } from '@ws/contracts';
import { Badge, Button, Card, Compteur, ElementDeSerie, Entree, Halo, Progress, Pressable, Serie, Skeleton } from '@ws/ui';
import { useDashboardControllerDashboard } from '@/api/generated';
import type { DashboardControllerDashboard200 } from '@/api/model';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calculator,
  Compass,
  Factory,
  HelpCircle,
  PackageSearch,
  RefreshCw,
  Ship,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api-fetcher';
import { useEffect } from 'react';

/** Actions rapides du cockpit (§11). Chaque libellé est un verbe précis (§45). */
const QUICK_ACTIONS = [
  { href: '/opportunites', label: 'Trouver un produit', icon: PackageSearch },
  { href: '/calculateur', label: 'Calculer ma rentabilité', icon: Calculator },
  { href: '/fournisseurs', label: 'Trouver un fournisseur', icon: Factory },
  { href: '/importations', label: 'Suivre mes colis', icon: Ship },
  { href: '/academy', label: 'Me former', icon: BookOpen },
  { href: '/aide', label: 'Obtenir de l’aide', icon: HelpCircle },
] as const;

export function DashboardView() {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useDashboardControllerDashboard({
    query: { retry: false },
  });

  // Session absente ou expirée : on renvoie vers la connexion plutôt que d'afficher une erreur.
  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) router.replace('/connexion');
  }, [isError, error, router]);

  if (isPending) return <DashboardSkeleton />;

  if (isError) {
    return (
      <Wrapper>
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Vos informations n’ont pas pu être chargées</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Une erreur inattendue s'est produite."}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <Entree geste="interface">
        <Header data={data} />
      </Entree>

      <Entree geste="carte" delai={0.08}>
        <NextActionCard action={data.nextAction} />
      </Entree>

      <section aria-labelledby="activite">
        <h2 id="activite" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Mon activité
        </h2>
        <Entree geste="carte" delai={0.14}>
          <Card className="grid grid-cols-3 gap-2">
            <Figure label="Commandes actives" value={data.activity.activeOrders} />
            <Figure label="En transit" value={data.activity.inTransit} />
            <Figure label="À récupérer" value={data.activity.readyForPickup} accent />
          </Card>
        </Entree>
      </section>

      <section aria-labelledby="actions">
        <h2 id="actions" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Actions rapides
        </h2>
        <Serie className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }, index) => (
            <ElementDeSerie
              key={href}
              auScroll={false}
              geste="interface"
              index={index}
              total={QUICK_ACTIONS.length}
              delaiBase={0.16}
            >
              <Pressable className="h-full">
                <Link
                  href={href}
                  className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm font-medium shadow-card transition-colors hover:bg-surface-muted"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-imperial-soft text-imperial">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </Link>
              </Pressable>
            </ElementDeSerie>
          ))}
        </Serie>
      </section>

      <section aria-labelledby="commande">
        <h2 id="commande" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Ma commande en cours
        </h2>
        {data.urgentOrder ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="figures font-semibold">{data.urgentOrder.reference}</span>
              <Badge tone="night">{data.urgentOrder.stageLabel}</Badge>
            </div>
            <Progress value={data.urgentOrder.progress * 100} className="mt-3" />
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Étape actuelle</dt>
                <dd className="font-semibold">{data.urgentOrder.stageLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prochaine étape</dt>
                <dd className="font-semibold text-muted-foreground">{data.urgentOrder.nextStageLabel ?? 'Terminée'}</dd>
              </div>
            </dl>
            {data.urgentOrder.lastEvent && (
              <p className="mt-3 text-sm text-muted-foreground">
                {data.urgentOrder.lastEvent.description}{' '}
                <span className="figures">
                  ({new Date(data.urgentOrder.lastEvent.occurredAt).toLocaleDateString('fr-CM')})
                </span>
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="figures font-semibold">
                {formatMoney({ amountMinor: data.urgentOrder.totalXaf, currency: 'XAF' })}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/importations">
                  Voir le suivi
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="Aucune commande en cours"
            text="Partez d’un budget : le calculateur vous donne le coût rendu au Cameroun et la marge possible avant de vous engager."
            action={{ href: '/calculateur', label: 'Calculer ma rentabilité' }}
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="opportunites">
          <h2 id="opportunites" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Opportunités pour vous
          </h2>
          {data.opportunities.length === 0 && (
            <EmptyState
              title="Le catalogue arrive"
              text="Nous n’affichons une opportunité que lorsque son prix en Chine, son coût rendu et le prix local observé ont été vérifiés."
              action={{ href: '/opportunites', label: 'Découvrir les opportunités' }}
              icon={Compass}
            />
          )}
        </section>

        <section aria-labelledby="formation">
          <h2 id="formation" className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Ma formation
          </h2>
          {data.currentCourse ? (
            <Card>
              <h3 className="font-semibold">{data.currentCourse.title}</h3>
              <Progress value={data.currentCourse.progressPercent} className="mt-3" />
              <Button asChild size="sm" className="mt-4">
                <Link href={data.currentCourse.href}>Reprendre la leçon</Link>
              </Button>
            </Card>
          ) : (
            <EmptyState
              title="Aucune formation commencée"
              text="Une formation doit mener à une action réelle : un produit, un fournisseur, une commande."
              action={{ href: '/academy', label: 'Voir les formations' }}
              icon={BookOpen}
            />
          )}
        </section>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:px-6 md:py-8">{children}</div>;
}

function Header({ data }: { data: DashboardControllerDashboard200 }) {
  // Une inscription par téléphone n'a pas encore de nom : on affiche le numéro mis en forme.
  const isPhone = /^\+\d+$/.test(data.user.displayName);
  const label = isPhone ? formatPhoneForDisplay(data.user.displayName) : data.user.displayName;
  const initials = data.user.displayName
    .replaceAll(/[^\p{L}]/gu, '')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-night text-sm font-bold text-white">
          {isPhone || !initials ? <UserRound className="size-5" aria-hidden /> : initials}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{greetingByHour()}</p>
          <h1 className={`truncate font-display text-xl font-bold tracking-tight ${isPhone ? 'figures' : ''}`}>
            {label}
          </h1>
        </div>
      </div>
      <Link
        href="/notifications"
        aria-label={
          data.unreadNotifications > 0 ? `Notifications : ${data.unreadNotifications} non lues` : 'Notifications'
        }
        className="relative flex size-11 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Bell className="size-5" aria-hidden />
        {data.unreadNotifications > 0 && (
          <span className="figures absolute -top-1 -right-1 min-w-5 rounded-full bg-imperial px-1 text-center text-[11px] font-bold text-white">
            {data.unreadNotifications}
          </span>
        )}
      </Link>
    </header>
  );
}

function NextActionCard({ action }: { action: DashboardControllerDashboard200['nextAction'] }) {
  return (
    <Card className="relative overflow-hidden border-none bg-night p-5 text-white">
      <Halo className="bg-[radial-gradient(60%_60%_at_80%_0%,rgb(212_165_55/0.22),transparent_70%)]" />
      <span className="relative text-xs font-semibold tracking-wide text-gold uppercase">Votre prochaine action</span>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight">{action.label}</h2>
      <p className="mt-1.5 text-sm text-white/70">{action.reason}</p>
      <Button asChild variant="gold" className="mt-4">
        <Link href={action.href}>
          {action.label}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}

function Figure({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <Compteur
        valeur={value}
        format={(v) => String(Math.round(v))}
        className={`mt-0.5 block text-2xl font-bold ${accent && value > 0 ? 'text-imperial' : ''}`}
      />
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  icon: Icon = PackageSearch,
}: {
  title: string;
  text: string;
  action: { href: string; label: string };
  icon?: typeof PackageSearch;
}) {
  return (
    <Card className="flex h-full flex-col items-start">
      <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link href={action.href}>
          {action.label}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <Wrapper>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="grid gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-lg" />
    </Wrapper>
  );
}

/** +237670445566 → +237 6 70 44 55 66 */
function formatPhoneForDisplay(value: string): string {
  const match = /^\+237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value);
  return match ? `+237 ${match.slice(1).join(' ')}` : value;
}

function greetingByHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

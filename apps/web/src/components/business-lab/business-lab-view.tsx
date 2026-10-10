'use client';

import type { BusinessProject } from '@ws/contracts';
import { Badge, Button, Card, Entree, GrilleAnimee, Money, MontantAnime, Progress, Skeleton } from '@ws/ui';
import { AlertTriangle, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  aujourdhui,
  enInstant,
  useBusinessProjects,
  useCreateProject,
} from './business-lab-client';

const FORM_VIDE = {
  name: '',
  capitalXaf: 0,
  quantity: 0,
  targetUnitPriceXaf: 0,
  orderReference: '',
  startedAt: aujourdhui(),
};

const xaf = (amountMinor: number) => ({ amountMinor, currency: 'XAF' as const });

/**
 * Business Lab (§27, LAB-01 et LAB-02).
 *
 * L'écran ne montre que du constaté. Pas de projection du type « au rythme actuel, vous
 * aurez tout vendu dans trois semaines » : personne n'a mesuré ce rythme, et une
 * prévision fausse coûte plus cher qu'une absence de prévision.
 *
 * La phrase d'état vient du serveur plutôt que d'être réécrite ici : c'est la même
 * formulation partout, et elle ne peut pas contredire les chiffres affichés à côté.
 */
export function BusinessLabView() {
  const { data, isPending, isError, error, refetch, isRefetching } = useBusinessProjects();
  const creer = useCreateProject();
  const [creation, setCreation] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);

  const coutUnitaire =
    form.quantity > 0 && form.capitalXaf > 0 ? Math.round(form.capitalXaf / form.quantity) : null;
  const complet =
    form.name.trim().length >= 3 &&
    form.capitalXaf > 0 &&
    form.quantity > 0 &&
    form.targetUnitPriceXaf > 0;

  async function enregistrer() {
    await creer.mutateAsync({
      name: form.name.trim(),
      capitalXaf: form.capitalXaf,
      quantity: form.quantity,
      targetUnitPriceXaf: form.targetUnitPriceXaf,
      orderReference: form.orderReference.trim() || null,
      startedAt: enInstant(form.startedAt),
      notes: null,
    });
    setCreation(false);
    setForm(FORM_VIDE);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Entree geste="paragraphe" as="header">
        <h1 className="font-display text-2xl font-bold tracking-tight">Business Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ce qu’une importation a réellement rapporté : capital engagé, ventes saisies, marge constatée.
          Rien n’est extrapolé — les chiffres ne bougent que lorsque vous saisissez une vente.
        </p>
      </Entree>

      {data && data.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Resume label="Capital engagé" valeur={data.totalCapitalXaf} />
          <Resume label="Encaissé" valeur={data.totalRevenueXaf} />
          <Resume label="Marge constatée" valeur={data.totalMarginXaf} negatif={data.totalMarginXaf < 0} />
        </div>
      )}

      {!creation && (
        <div>
          <Button onClick={() => setCreation(true)}>
            <Plus aria-hidden />
            Ouvrir un projet
          </Button>
        </div>
      )}

      {creation && (
        <Card className="grid gap-3">
          <div>
            <h2 className="text-base font-semibold">Nouveau projet</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Le capital est tout ce que le lot vous a coûté, rendu au Cameroun : marchandise, transport
              et frais compris.
            </p>
          </div>

          <Champ label="Nom du projet" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />

          <div className="grid gap-3 sm:grid-cols-3">
            <ChampNombre
              label="Capital engagé (FCFA)"
              value={form.capitalXaf}
              onChange={(v) => setForm({ ...form, capitalXaf: v })}
            />
            <ChampNombre
              label="Unités achetées"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
            />
            <ChampNombre
              label="Prix de vente visé (FCFA)"
              value={form.targetUnitPriceXaf}
              onChange={(v) => setForm({ ...form, targetUnitPriceXaf: v })}
            />
          </div>

          {coutUnitaire !== null && (
            <p className="text-xs text-muted-foreground">
              Coût de revient : <Money value={xaf(coutUnitaire)} /> par unité.
              {form.targetUnitPriceXaf > 0 && form.targetUnitPriceXaf < coutUnitaire && (
                <span className="ml-1 text-warning">
                  Votre prix visé est en dessous : chaque unité serait vendue à perte.
                </span>
              )}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              label="Référence de l’importation (facultatif)"
              value={form.orderReference}
              onChange={(v) => setForm({ ...form, orderReference: v })}
              placeholder="WS-…"
            />
            <Champ
              label="Date de début"
              type="date"
              value={form.startedAt}
              onChange={(v) => setForm({ ...form, startedAt: v })}
            />
          </div>

          {creer.isError && (
            <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {creer.error instanceof Error ? creer.error.message : 'Le projet n’a pas pu être créé.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button loading={creer.isPending} disabled={!complet} onClick={() => void enregistrer()}>
              Ouvrir le projet
            </Button>
            <Button variant="outline" onClick={() => setCreation(false)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-center">
          <h2 className="font-display text-lg font-bold">Vos projets n’ont pas pu être chargés</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Connectez-vous pour retrouver vos projets.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="flex flex-col items-start">
          <span className="mb-3 inline-flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
            <TrendingUp className="size-5" aria-hidden />
          </span>
          <h2 className="font-semibold">Aucun projet pour l’instant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ouvrez-en un dès qu’une marchandise est arrivée : vous saurez à tout moment combien d’unités il
            reste à vendre, et à partir de quand vous gagnez de l’argent.
          </p>
        </Card>
      ) : (
        <GrilleAnimee signature={`projets-${data.items.length}`} className="grid gap-3">
          {data.items.map((projet) => (
            <ProjetTuile key={projet.id} projet={projet} />
          ))}
        </GrilleAnimee>
      )}
    </div>
  );
}

function ProjetTuile({ projet }: { projet: BusinessProject }) {
  const { metrics } = projet;

  return (
    <Card className="p-0">
      <Link
        href={`/business-lab/${projet.id}`}
        className="grid gap-3 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-imperial focus-visible:outline-none"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{projet.name}</span>
          {metrics.oversold ? (
            <Badge tone="warning">Saisie à vérifier</Badge>
          ) : metrics.capitalRecovered ? (
            <Badge tone="success">Capital récupéré</Badge>
          ) : (
            <Badge tone="neutral">En cours</Badge>
          )}
          {projet.orderReference && (
            <span className="figures text-xs text-muted-foreground">{projet.orderReference}</span>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span>Capital récupéré</span>
            <span className="figures">{metrics.capitalRecoveredPercent} %</span>
          </div>
          <Progress className="mt-1" value={metrics.capitalRecoveredPercent} />
        </div>

        <p className="flex items-start gap-2 text-sm">
          {metrics.oversold && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
          {projet.progressLabel}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Chiffre label="Encaissé" valeur={<Money value={xaf(metrics.revenueXaf)} />} />
          <Chiffre
            label="Marge constatée"
            valeur={<Money value={xaf(metrics.marginXaf)} />}
            negatif={metrics.marginXaf < 0}
          />
          <Chiffre label="ROI" valeur={`${metrics.roiPercent} %`} negatif={metrics.roiPercent < 0} />
          <Chiffre
            label="Reste à vendre"
            valeur={`${metrics.remainingQuantity} / ${projet.quantity}`}
          />
        </dl>
      </Link>
    </Card>
  );
}

function Resume({ label, valeur, negatif = false }: { label: string; valeur: number; negatif?: boolean }) {
  return (
    <Card>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display mt-1 text-xl font-bold ${negatif ? 'text-danger' : ''}`}>
        <MontantAnime value={xaf(valeur)} />
      </p>
    </Card>
  );
}

function Chiffre({
  label,
  valeur,
  negatif = false,
}: {
  label: string;
  valeur: React.ReactNode;
  negatif?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`figures font-semibold ${negatif ? 'text-danger' : ''}`}>{valeur}</dd>
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date';
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
      />
    </label>
  );
}

function ChampNombre({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isFinite(value) && value !== 0 ? value : ''}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        className="figures h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
      />
    </label>
  );
}

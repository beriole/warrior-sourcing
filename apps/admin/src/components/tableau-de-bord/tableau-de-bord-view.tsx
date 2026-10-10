'use client';

import {
  ADMIN_PERIODS,
  ADMIN_PERIOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type AdminDashboardResponse,
  type AdminPeriod,
} from '@ws/contracts';
import { Badge, Card, CardDescription, CardTitle, Money, ProvenanceBadge } from '@ws/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateHeure, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { EcranAcces, EnTete, MessageErreur, SqueletteListe } from '@/components/admin/etats';

/** Libellés des actions journalisées, pour ne jamais montrer un code technique (§45). */
const LIBELLES_ACTION: Record<string, string> = {
  'user.role.changed': 'Changement de rôle',
  'order.status.changed': 'Changement d’état de commande',
  'dispute.opened': 'Ouverture d’un litige',
  'dispute.status.changed': 'Avancement d’un litige',
};

function libelleAction(action: string) {
  return LIBELLES_ACTION[action] ?? action.replaceAll('.', ' · ');
}

/** Carte d'indicateur. Une période sans donnée affiche zéro, jamais un tiret trompeur. */
function Indicateur({
  libelle,
  valeur,
  precision,
}: {
  libelle: string;
  valeur: React.ReactNode;
  precision: string;
}) {
  return (
    <Card>
      <CardDescription>{libelle}</CardDescription>
      <CardTitle className="figures mt-2 text-2xl">{valeur}</CardTitle>
      <p className="mt-1 text-xs text-muted-foreground">{precision}</p>
    </Card>
  );
}

/**
 * Tableau de bord d'administration (ADM-01 et ADM-02, §37).
 *
 * Tous les chiffres viennent d'agrégations SQL : rien n'est recalculé ici, rien n'est estimé.
 * Le journal d'audit montre les dernières actions sensibles réellement enregistrées.
 */
export function TableauDeBordView() {
  const [periode, setPeriode] = useState<AdminPeriod>('30j');
  const [donnees, setDonnees] = useState<AdminDashboardResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let annule = false;

    appelApi<AdminDashboardResponse>(`/admin/dashboard?periode=${encodeURIComponent(periode)}`)
      .then((data) => {
        if (annule) return;
        setDonnees(data);
        setAcces('ok');
      })
      .catch((e: unknown) => {
        if (annule) return;
        const etat = etatDepuisErreur(e);
        if (etat) setAcces(etat);
        else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
  }, [periode, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="consulter le pilotage" onReessayer={recharger} />;
  }

  const stats = donnees?.stats;

  return (
    <div className="mx-auto max-w-6xl">
      <EnTete
        titre="Tableau de bord"
        sousTitre="Pilotage commerce, contenu et opérations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProvenanceBadge provenance="VERIFIED" />
            <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Période observée">
              {ADMIN_PERIODS.map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setPeriode(valeur)}
                  aria-pressed={periode === valeur}
                  className="min-h-11 rounded-sm px-3 text-sm font-semibold text-muted-foreground aria-pressed:bg-imperial-soft aria-pressed:text-imperial-hover"
                >
                  {ADMIN_PERIOD_LABELS[valeur]}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}

      {chargement || !stats ? (
        <SqueletteListe lignes={4} />
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            {stats.since
              ? `Période observée depuis le ${dateHeure(stats.since)}.`
              : 'Période observée : tout l’historique.'}{' '}
            Chiffres arrêtés au {dateHeure(stats.computedAt)}.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Indicateur
              libelle="Chiffre d’affaires encaissé"
              valeur={<Money value={xaf(stats.revenue.netXaf)} />}
              precision={`${stats.revenue.paymentCount} paiement(s) encaissé(s), ${new Intl.NumberFormat('fr-FR').format(stats.revenue.refundedXaf)} FCFA remboursé(s).`}
            />
            <Indicateur
              libelle="Commandes"
              valeur={stats.orders.total}
              precision={`${stats.orders.paid} payée(s), ${stats.orders.pendingPayment} en attente, ${stats.orders.cancelled} annulée(s).`}
            />
            <Indicateur
              libelle="Montant des commandes payées"
              valeur={<Money value={xaf(stats.orders.paidAmountXaf)} />}
              precision="Total figé au moment de la commande."
            />
            <Indicateur
              libelle="Nouveaux clients"
              valeur={stats.customers.newAccounts}
              precision={`${stats.customers.totalAccounts} compte(s) client au total.`}
            />
            <Indicateur
              libelle="Clients ayant commandé"
              valeur={stats.customers.activeBuyers}
              precision="Comptes distincts avec au moins une commande sur la période."
            />
            <Indicateur
              libelle="Précommandes"
              valeur={stats.preorders.participations}
              precision={`${stats.preorders.openCampaigns} campagne(s) ouverte(s) aujourd’hui.`}
            />
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Paiements par état</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Un état sans paiement sur la période reste affiché à zéro.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">État</th>
                    <th className="py-2 pr-3 text-right font-semibold">Nombre</th>
                    <th className="py-2 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.payments.byStatus.map((ligne) => (
                    <tr key={ligne.status} className="border-b border-border/60">
                      <td className="py-2 pr-3">{PAYMENT_STATUS_LABELS[ligne.status]}</td>
                      <td className="figures py-2 pr-3 text-right">{ligne.count}</td>
                      <td className="py-2 text-right">
                        <Money value={xaf(ligne.amountXaf)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Dernières actions sensibles</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Journal d’audit : {donnees.audit.total} action(s) enregistrée(s) depuis l’ouverture.
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                <Link className="text-primary underline-offset-4 hover:underline" href="/utilisateurs">
                  Utilisateurs
                </Link>
                <Link className="text-primary underline-offset-4 hover:underline" href="/commandes">
                  Commandes
                </Link>
                <Link className="text-primary underline-offset-4 hover:underline" href="/litiges">
                  Litiges
                </Link>
              </div>
            </div>

            {donnees.audit.entries.length === 0 ? (
              <Card className="mt-3 text-center">
                <p className="text-sm font-semibold">Aucune action sensible pour l’instant</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les changements de rôle, d’état de commande et les litiges s’inscriront ici.
                </p>
              </Card>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {donnees.audit.entries.map((entree) => (
                  <li key={entree.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="night">{libelleAction(entree.action)}</Badge>
                      <span className="text-muted-foreground">{dateHeure(entree.createdAt)}</span>
                      {entree.actorName ? <span className="font-semibold">{entree.actorName}</span> : null}
                    </div>
                    {entree.metadata ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(entree.metadata)
                          .map(([cle, valeur]) => `${cle} : ${String(valeur)}`)
                          .join(' — ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

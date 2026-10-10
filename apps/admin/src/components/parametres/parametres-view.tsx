'use client';

import type { AdminIntegrationsResponse, IntegrationHealth } from '@ws/contracts';
import { Badge, Card } from '@ws/ui';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, etatDepuisErreur, type EtatAcces } from '@/components/admin/api';
import { EcranAcces, EnTete, MessageErreur, SqueletteListe } from '@/components/admin/etats';

const ETATS: Record<IntegrationHealth, { label: string; tone: 'success' | 'warning' | 'danger'; icon: typeof CheckCircle2 }> = {
  OK: { label: 'En place', tone: 'success', icon: CheckCircle2 },
  DEGRADED: { label: 'Dégradé', tone: 'warning', icon: AlertTriangle },
  MISSING: { label: 'Manquant', tone: 'danger', icon: XCircle },
};

/**
 * État des intégrations.
 *
 * Aucune valeur secrète n'est affichée : seulement ce qui est en place et ce que l'absence
 * entraîne. L'intérêt est qu'une clé manquante se voie ici plutôt que chez un client — un
 * secret de webhook absent, par exemple, fait rejeter toutes les confirmations de paiement
 * sans qu'aucun écran ne le signale par ailleurs.
 */
export function ParametresView() {
  const [data, setData] = useState<AdminIntegrationsResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    appelApi<AdminIntegrationsResponse>('/admin/integrations')
      .then((reponse) => {
        setData(reponse);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="consulter la configuration" onReessayer={rafraichir} />;
  }

  const aRegler = data?.items.filter((item) => item.health !== 'OK') ?? [];

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Paramètres"
        sousTitre="Ce que le serveur sait de sa propre configuration. Aucune clé n’est affichée, seulement sa présence."
      />

      {data && (
        <p className="text-xs text-muted-foreground">
          Environnement : <span className="figures font-semibold">{data.environment}</span>
          {aRegler.length > 0 &&
            ` · ${aRegler.length} point${aRegler.length > 1 ? 's' : ''} à régler`}
        </p>
      )}

      {erreur && <MessageErreur>{erreur}</MessageErreur>}

      {chargement ? (
        <SqueletteListe lignes={4} />
      ) : (
        <ul className="grid gap-2">
          {data?.items.map((item) => {
            const etat = ETATS[item.health];
            const Icone = etat.icon;
            return (
              <li key={item.key}>
                <Card className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icone
                      className={`size-4 shrink-0 ${
                        item.health === 'OK'
                          ? 'text-success'
                          : item.health === 'DEGRADED'
                            ? 'text-warning'
                            : 'text-danger'
                      }`}
                      aria-hidden
                    />
                    <span className="font-semibold">{item.label}</span>
                    <Badge tone={etat.tone}>{etat.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                  {item.consequence && (
                    <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                      {item.consequence}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

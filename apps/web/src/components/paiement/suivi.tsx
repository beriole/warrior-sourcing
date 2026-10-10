'use client';

import { useQuery } from '@tanstack/react-query';
import type { PaymentStateResponse } from '@ws/contracts';
import { Badge, Card } from '@ws/ui';
import { Mail, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '@/lib/api-fetcher';

/**
 * Suivi de la confirmation d'un paiement Mobile Money.
 *
 * Indispensable : la validation se fait sur le téléphone, hors de l'application. Sans
 * cette interrogation, l'écran resterait sur « demande envoyée » même après un paiement
 * réussi, et le client conclurait que ça n'a pas marché.
 *
 * Elle s'arrête d'elle-même dès que l'état ne peut plus changer, et au bout de trois
 * minutes : une page qui interroge indéfiniment coûte des données mobiles à quelqu'un qui
 * a refermé son téléphone.
 */
const PERIODE_MS = 4000;
const ESSAIS_MAX = Math.round((3 * 60 * 1000) / PERIODE_MS);

/** Ce qu'on retient d'un encaissement lancé, et qui suffit à en suivre la suite. */
export type Lancement = {
  paymentReference: string | null;
  email: string | null;
  accountCreated: boolean;
  nextStep: string;
  /** Ce qui a été acheté, tel qu'il s'écrit dans un titre. */
  libelle: string;
};

export function SuiviPaiement({
  lancement,
  onTermine,
}: {
  lancement: Lancement;
  /** Appelé une seule fois, quand l'état devient définitif. */
  onTermine: () => void;
}) {
  const [essais, setEssais] = useState(0);
  const reference = lancement.paymentReference;

  const { data, isError } = useQuery<PaymentStateResponse>({
    queryKey: ['paiement', reference],
    enabled: reference !== null && essais < ESSAIS_MAX,
    queryFn: async ({ signal }) => {
      setEssais((precedent) => precedent + 1);
      const etat = await apiRequest<PaymentStateResponse>(`/v1/payments/${reference}/etat`, { signal });
      if (etat.settled) onTermine();
      return etat;
    },
    refetchInterval: (query) => (query.state.data?.settled ? false : PERIODE_MS),
    refetchOnWindowFocus: true,
  });

  // Rendu gratuit par une promotion : il n'y a aucun paiement à suivre.
  if (!reference) {
    return (
      <Card className="grid gap-2 border-success/40">
        <h2 className="text-base font-semibold text-success">{lancement.libelle} — ouvert</h2>
        <p className="text-sm text-muted-foreground">{lancement.nextStep}</p>
        {lancement.email && <Identifiants email={lancement.email} compteCree={lancement.accountCreated} />}
      </Card>
    );
  }

  const reussi = data?.status === 'SUCCEEDED';
  const echoue = data?.status === 'FAILED' || data?.status === 'EXPIRED';

  return (
    <Card className={`grid gap-3 ${reussi ? 'border-success/40' : echoue ? 'border-danger/40' : 'border-primary'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Paiement — {lancement.libelle}</h2>
        {data && <Badge tone={reussi ? 'success' : echoue ? 'danger' : 'warning'}>{data.statusLabel}</Badge>}
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden />
        {data?.instruction ?? lancement.nextStep}
      </p>

      {/* La référence est ce qui permet de retrouver le paiement : elle reste visible. */}
      <p className="text-xs text-muted-foreground">
        Référence du paiement : <span className="figures font-semibold">{reference}</span>
      </p>

      {reussi && lancement.email && (
        <Identifiants email={lancement.email} compteCree={lancement.accountCreated} />
      )}

      {!data && !isError && (
        <p className="text-sm text-muted-foreground">Vérification de l’état auprès de l’opérateur…</p>
      )}

      {isError && (
        <p role="alert" className="text-sm text-muted-foreground">
          L’état du paiement n’a pas pu être lu. Si vous avez validé la demande, le paiement reste
          enregistré : conservez la référence ci-dessus.
        </p>
      )}

      {essais >= ESSAIS_MAX && !data?.settled && (
        <p className="text-sm text-muted-foreground">
          Nous avons arrêté de vérifier après trois minutes. Rechargez la page pour reprendre le suivi.
        </p>
      )}
    </Card>
  );
}

/** Ce que le client doit attendre dans sa boîte, dit sans promettre plus que ce qui part. */
export function Identifiants({ email, compteCree }: { email: string; compteCree: boolean }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
      <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        {compteCree ? (
          <>
            Vos identifiants de connexion partent à <strong>{email}</strong>. Vous pourrez aussi vous
            connecter par code à six chiffres envoyé à cette même adresse.
          </>
        ) : (
          <>
            Un compte existe déjà pour <strong>{email}</strong> : votre accès y est ouvert, et vous vous
            connectez avec vos identifiants habituels. Aucun mot de passe n’a été changé.
          </>
        )}
      </span>
    </p>
  );
}

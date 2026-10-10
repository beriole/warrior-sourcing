'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BuyCourseRequest, BuyCourseResponse, CourseCard, Priced } from '@ws/contracts';
import { Button, Card, ConditionsPromotion, Prix } from '@ws/ui';
import { Lock, Tag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ChampsIdentite, ChampTelephone, ChoixOperateur } from '@/components/paiement/champs';
import { SuiviPaiement, type Lancement } from '@/components/paiement/suivi';
import { apiRequest } from '@/lib/api-fetcher';
import { isValidLocalPhone } from '@/lib/phone';
import type { CheckoutPaymentMethod } from '@ws/contracts';

/**
 * Achat d'une formation à l'unité (SUB-02).
 *
 * Jusqu'ici, une fiche payante affichait un prix et… rien. On pouvait fixer un tarif que
 * personne ne pouvait régler. Un prix sans moyen de payer est pire qu'un prix absent : il
 * fait croire à une boutique.
 *
 * Le montant vient du serveur, remise comprise. L'écran ne recalcule rien : c'est la
 * seule façon d'être sûr que le montant annoncé est celui qui sera débité.
 */
export function PanneauAchat({
  course,
  connecte,
}: {
  course: Pick<CourseCard, 'slug' | 'title' | 'priceXaf'> & { priced: Priced };
  connecte: boolean;
}) {
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('MTN_MOMO');
  const [enCours, setEnCours] = useState<Lancement | null>(null);

  const acheter = useMutation<Lancement, Error, void>({
    mutationFn: async () => {
      const reponse = await apiRequest<BuyCourseResponse>(
        `/v1/academy/courses/${encodeURIComponent(course.slug)}/achat`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(connecte ? {} : { fullName: nom.trim(), email: email.trim() }),
            payerPhone: telephone.replaceAll(/\D/g, ''),
            paymentMethod,
            promotionCode: code.trim() || null,
          } satisfies BuyCourseRequest),
        },
      );
      return {
        paymentReference: reponse.paymentReference,
        email: reponse.email,
        accountCreated: reponse.accountCreated,
        nextStep: reponse.nextStep,
        libelle: reponse.purchase.courseTitle,
      };
    },
    onSuccess: (lancement) => {
      setOuvert(false);
      setEnCours(lancement);
    },
  });

  if (enCours) {
    return (
      <SuiviPaiement
        lancement={enCours}
        // Ciblé : sans clé, l'invalidation relancerait aussi la requête d'état du paiement,
        // qui rappellerait cette fonction — une boucle sans fin.
        onTermine={() => void queryClient.invalidateQueries({ queryKey: ['academy', 'formation', course.slug] })}
      />
    );
  }

  const complet =
    (connecte || (nom.trim().length >= 2 && /.+@.+\..+/.test(email.trim()))) &&
    isValidLocalPhone(telephone);

  return (
    <Card className="grid gap-3 border-gold/40 bg-gold-soft/30">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-gold-ink">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">Accès à cette formation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paiement unique. L’accès reste ouvert sans limite de durée, et les extraits offerts se
            consultent sans rien payer.
          </p>
        </div>
      </div>

      <div className="grid gap-0.5">
        <Prix priced={course.priced} className="text-2xl" />
        <ConditionsPromotion priced={course.priced} />
      </div>

      {!ouvert ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOuvert(true)}>Acheter cette formation</Button>
          {!connecte && (
            <Button asChild variant="outline">
              <Link href="/connexion">J’ai déjà un compte</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 border-t border-border pt-4">
          {!connecte && (
            <>
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
                Pas encore de compte ? Il est créé avec ce paiement, et vos identifiants de connexion
                vous sont envoyés par courriel dès la confirmation.
              </p>
              <ChampsIdentite prefixe="achat" nom={nom} email={email} onNom={setNom} onEmail={setEmail} />
            </>
          )}

          <ChampTelephone prefixe="achat" valeur={telephone} onChange={setTelephone} />

          <label className="grid max-w-xs gap-1 text-sm">
            <span className="font-medium">Code promotionnel (facultatif)</span>
            <span className="flex items-center gap-2">
              <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={code}
                maxLength={24}
                placeholder="RENTREE25"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
              />
            </span>
          </label>

          <ChoixOperateur valeur={paymentMethod} onChange={setPaymentMethod} />

          {acheter.isError && (
            <p
              role="alert"
              className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {acheter.error instanceof Error ? acheter.error.message : 'L’achat n’a pas abouti.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button loading={acheter.isPending} disabled={!complet} onClick={() => acheter.mutate()}>
              Confirmer et payer
            </Button>
            <Button variant="outline" onClick={() => setOuvert(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

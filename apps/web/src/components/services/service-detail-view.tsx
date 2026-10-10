'use client';

import { CHECKOUT_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type CheckoutPaymentMethod } from '@ws/contracts';
import { Badge, Button, Card, Entree, Money, Skeleton } from '@ws/ui';
import { AlertCircle, ArrowLeft, Check, Clock, FileText, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useOrderService, useService } from './services-client';

/**
 * Fiche d'une prestation et commande (SRV-01, SRV-02).
 *
 * Le formulaire ne transporte aucun montant : le prix affiché vient de la fiche, et c'est
 * le serveur qui le fige sur la commande. Si la prestation est sur devis, il n'y a pas de
 * formulaire de paiement du tout — on explique pourquoi, au lieu de présenter un bouton
 * qui échouerait.
 */
export function ServiceDetailView({ slug }: { slug: string }) {
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useService(slug);
  const commander = useOrderService();

  const [brief, setBrief] = useState('');
  const [city, setCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [budget, setBudget] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('MTN_MOMO');
  const [payerPhone, setPayerPhone] = useState('');

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 md:px-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette prestation n’a pas pu être chargée</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
          </p>
          <Button className="mt-4" onClick={() => void refetch()} loading={isRefetching}>
            <RefreshCw aria-hidden />
            Réessayer
          </Button>
        </Card>
      </div>
    );
  }

  const { service } = data;
  const briefAssezLong = brief.trim().length >= 20;
  const complet = briefAssezLong && city.trim().length >= 2 && contactPhone.trim().length >= 9;

  async function envoyer() {
    const reponse = await commander.mutateAsync({
      serviceSlug: service.slug,
      brief: brief.trim(),
      city: city.trim(),
      contactPhone: contactPhone.trim(),
      quantity: quantity ? Number(quantity) : undefined,
      budgetXaf: budget ? Number(budget) : undefined,
      links: [],
      paymentMethod,
      payerPhone: payerPhone.trim() || undefined,
    });
    router.push(`/services/demandes/${reponse.order.reference}`);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Link
        href="/services"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Services
      </Link>

      <Entree geste="paragraphe" as="header">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{service.categoryLabel}</Badge>
          {service.orderable ? (
            <Badge tone="success">Payable en ligne</Badge>
          ) : (
            <Badge tone="warning">{service.pricingModeLabel}</Badge>
          )}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{service.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{service.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold">
            {service.priceXaf === null ? (
              <span className="text-muted-foreground">Tarif sur devis</span>
            ) : (
              <>
                {service.pricingMode === 'FROM' && (
                  <span className="mr-1 text-xs font-normal text-muted-foreground">à partir de</span>
                )}
                <Money value={{ amountMinor: service.priceXaf, currency: 'XAF' }} />
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {service.leadTimeLabel}
          </span>
        </div>
        {service.leadTimeNote && (
          <p className="mt-1 text-xs text-muted-foreground">{service.leadTimeNote}</p>
        )}
      </Entree>

      <Card className="ws-onview" suppressHydrationWarning>
        <h2 className="text-base font-semibold">En quoi consiste cette prestation</h2>
        <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="ws-onview" suppressHydrationWarning>
          <h2 className="text-base font-semibold">Ce que vous recevez</h2>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {service.deliverables.map((livrable) => (
              <li key={livrable} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {livrable}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="ws-onview" suppressHydrationWarning>
          <h2 className="text-base font-semibold">Ce que la prestation ne couvre pas</h2>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground">
            {service.conditions.map((condition) => (
              <li key={condition} className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {condition}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {service.requirements.length > 0 && (
        <Card className="ws-onview" suppressHydrationWarning>
          <h2 className="text-base font-semibold">Ce que vous devez fournir</h2>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {service.requirements.map((prerequis) => (
              <li key={prerequis} className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {prerequis}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="ws-onview" suppressHydrationWarning>
        <h2 className="text-base font-semibold">Demander cette prestation</h2>

        {!service.orderable ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {service.notOrderableReason} Écrivez-nous depuis la messagerie pour obtenir un devis : nous avons
            besoin de votre besoin précis avant d’annoncer un prix.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Le montant est celui annoncé ci-dessus. Il est figé au moment de votre demande, même si la fiche
              change ensuite.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Votre besoin</span>
                <textarea
                  value={brief}
                  rows={4}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Ce que vous attendez, le produit concerné, le fournisseur si vous en avez un…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus-visible:border-primary"
                />
                <span className="text-xs text-muted-foreground">
                  {briefAssezLong
                    ? 'Merci, c’est assez précis pour démarrer.'
                    : '20 caractères minimum : sans votre besoin, la prestation ne peut pas commencer.'}
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <Champ label="Votre ville" value={city} onChange={setCity} placeholder="Douala" />
                <Champ
                  label="Téléphone de contact"
                  value={contactPhone}
                  onChange={setContactPhone}
                  placeholder="6XXXXXXXX"
                  numerique
                />
                <Champ
                  label="Quantité concernée (facultatif)"
                  value={quantity}
                  onChange={setQuantity}
                  numerique
                />
                <Champ
                  label="Budget visé en FCFA (facultatif)"
                  value={budget}
                  onChange={setBudget}
                  numerique
                />
              </div>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Payer avec</legend>
                <div className="flex flex-wrap gap-2">
                  {CHECKOUT_PAYMENT_METHODS.map((methode) => (
                    <button
                      key={methode}
                      type="button"
                      onClick={() => setPaymentMethod(methode)}
                      aria-pressed={paymentMethod === methode}
                      className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                        paymentMethod === methode
                          ? 'border-primary bg-imperial-soft'
                          : 'border-border bg-surface hover:bg-surface-muted'
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[methode]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Champ
                label="Numéro à débiter, s’il est différent (facultatif)"
                value={payerPhone}
                onChange={setPayerPhone}
                placeholder="6XXXXXXXX"
                numerique
              />

              {commander.isError && (
                <p role="alert" className="rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {commander.error instanceof Error
                    ? commander.error.message
                    : 'La demande n’a pas pu être envoyée.'}
                </p>
              )}

              <Button size="lg" block disabled={!complet} loading={commander.isPending} onClick={() => void envoyer()}>
                Demander et payer
                {service.priceXaf !== null && (
                  <>
                    {' — '}
                    <Money value={{ amountMinor: service.priceXaf, currency: 'XAF' }} />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                La demande de paiement est poussée sur votre téléphone. La prestation démarre une fois le
                paiement confirmé.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
  placeholder,
  numerique = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  numerique?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        inputMode={numerique ? 'numeric' : 'text'}
        placeholder={placeholder}
        onChange={(event) => onChange(numerique ? event.target.value.replaceAll(/\D/g, '') : event.target.value)}
        className={`h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary ${
          numerique ? 'figures' : ''
        }`}
      />
    </label>
  );
}

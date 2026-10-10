'use client';

import { SUPPLIER_REQUEST_KIND_LABELS, type SupplierRequestKind } from '@ws/contracts';
import { Button, Card } from '@ws/ui';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api-fetcher';
import { createSupplierRequest } from './api';

/**
 * Formulaire « Demander un devis » / « Demander un sourcing » (SUP-05).
 * Le serveur exige une session : sans compte, l'utilisateur est envoyé vers la connexion.
 */
export function RequestForm({
  supplierId,
  kind,
  onClose,
}: {
  supplierId: string;
  kind: SupplierRequestKind;
  onClose: () => void;
}) {
  const router = useRouter();
  const [productLabel, setProductLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState('');
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createSupplierRequest(supplierId, {
        kind,
        productLabel: productLabel.trim(),
        quantity: quantity ? Number(quantity) : undefined,
        // Les montants restent des entiers : 1 FCFA = 1 unité, jamais de virgule.
        budgetXafMinor: budget ? Math.trunc(Number(budget)) : undefined,
        city: city.trim() || undefined,
        details: details.trim() || undefined,
      }),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) router.push('/connexion');
    },
  });

  if (mutation.isSuccess) {
    return (
      <Card className="border-success/40">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <h3 className="font-semibold">Demande envoyée</h3>
            <p className="figures mt-1 text-sm text-muted-foreground">Référence {mutation.data.reference}</p>
            <p className="mt-2 text-sm">{mutation.data.nextStep}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{SUPPLIER_REQUEST_KIND_LABELS[kind]}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer le formulaire">
          <X aria-hidden />
        </Button>
      </div>

      <form
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Produit recherché" required>
          <input
            required
            minLength={3}
            maxLength={160}
            value={productLabel}
            onChange={(event) => setProductLabel(event.target.value)}
            placeholder="Exemple : coque de téléphone silicone"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantité souhaitée">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </Field>
          <Field label="Budget (FCFA)">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </Field>
        </div>

        <Field label="Ville de livraison">
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Douala, Yaoundé…"
            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          />
        </Field>

        <Field label="Précisions (qualité, couleur, logo, emballage)">
          <textarea
            rows={3}
            maxLength={2000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="w-full rounded-md border border-border bg-surface p-3 text-sm"
          />
        </Field>

        {mutation.isError && (
          <p role="alert" className="text-sm text-danger">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'La demande n’a pas pu être envoyée. Réessayez dans un instant.'}
          </p>
        )}

        <Button type="submit" loading={mutation.isPending} block>
          Envoyer ma demande
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span aria-hidden> *</span>}
      </span>
      {children}
    </label>
  );
}

'use client';

import type { SupplierRequestKind } from '@ws/contracts';
import { Badge, Button, Card, ProvenanceBadge, Skeleton, VerificationBadge } from '@ws/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ExternalLink,
  FileText,
  Lock,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '@/lib/api-fetcher';
import { fetchSupplier, fetchSupplierContact, formatCny, formatDate } from './api';
import { RequestForm } from './request-form';

/**
 * Fiche fournisseur (§15, §16, §17, SUP-05).
 *
 * Aperçu public : usine, produits, conditions, documents, incidents et photos sont visibles
 * de tous. Les coordonnées, elles, ne sont jamais dans cette réponse : elles se demandent
 * à une route à part, que le serveur refuse si le compte n'y a pas droit.
 */
export function SupplierDetailView({ id }: { id: string }) {
  const [openForm, setOpenForm] = useState<SupplierRequestKind | null>(null);

  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['fournisseur', id],
    queryFn: () => fetchSupplier(id),
    retry: false,
  });

  if (isPending) return <DetailSkeleton />;

  if (isError) {
    return (
      <Wrapper>
        <Card className="text-center">
          <h1 className="font-display text-lg font-bold">Cette fiche n’a pas pu être chargée</h1>
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

  const verifiedOn = formatDate(data.verification?.verifiedAt ?? null);
  const lastCheck = formatDate(data.verification?.lastVerifiedAt ?? null);

  return (
    <Wrapper>
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/fournisseurs">
          <ArrowLeft aria-hidden />
          Tous les fournisseurs
        </Link>
      </Button>

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.typeLabel} · {data.city}
        </p>

        <div className="mt-3">
          {/* §16 : un badge ne s'affiche jamais sans sa preuve ni sa date. */}
          {data.verification && verifiedOn ? (
            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge
                level={data.verification.level}
                verifiedAt={new Date(data.verification.verifiedAt)}
              />
              <span className="figures text-xs text-muted-foreground">
                {data.verification.meaning} Preuve du {verifiedOn}
                {lastCheck && lastCheck !== verifiedOn ? `, dernier contrôle le ${lastCheck}` : ''}.
              </span>
              <a
                href={data.verification.evidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Voir la preuve
              </a>
            </div>
          ) : (
            <Badge tone="neutral">Non vérifié : aucune preuve enregistrée</Badge>
          )}
        </div>

        {data.publicSummary && <p className="mt-3 text-sm">{data.publicSummary}</p>}
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => setOpenForm('QUOTE')} block>
          Demander un devis
        </Button>
        <Button variant="night" onClick={() => setOpenForm('SOURCING')} block>
          Demander un sourcing
        </Button>
      </div>

      {openForm && <RequestForm supplierId={id} kind={openForm} onClose={() => setOpenForm(null)} />}

      <ContactSection supplierId={id} granted={data.contactAccess.granted} reason={data.contactAccess.reason} />

      {/* ── Usine ── */}
      <Section title="L’usine" icon={ShieldCheck}>
        {data.profile ? (
          <Card>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Item label="Création" value={data.profile.foundedYear?.toString() ?? null} />
              <Item label="Effectif" value={data.profile.employeeCount?.toString() ?? null} />
              <Item label="Taille" value={data.profile.factoryScaleLabel} />
              <Item label="Lignes de production" value={data.profile.productionLines?.toString() ?? null} />
              <Item label="Capacité mensuelle" value={data.profile.monthlyCapacity?.toString() ?? null} />
              <Item label="Province" value={data.profile.province} />
              <Item label="Usine en propre" value={data.profile.ownsFactory ? 'Oui' : 'Non'} />
              <Item
                label="Expérience à l’export"
                value={data.profile.exportExperienceYears ? `${data.profile.exportExperienceYears} ans` : null}
              />
              <Item
                label="Délai de réponse"
                value={data.profile.responseTimeHours ? `${data.profile.responseTimeHours} h` : null}
              />
            </dl>

            {data.profile.certifications.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.profile.certifications.map((certification) => (
                  <Badge key={certification} tone="neutral">
                    {certification}
                  </Badge>
                ))}
              </div>
            )}

            {data.profile.presentation && <p className="mt-3 text-sm">{data.profile.presentation}</p>}

            {data.profile.checkedAt && (
              <p className="figures mt-3 text-xs text-muted-foreground">
                Informations contrôlées le {formatDate(data.profile.checkedAt)}.
              </p>
            )}
          </Card>
        ) : (
          <Empty text="Le profil d’usine de ce fournisseur n’a pas encore été relevé par notre équipe." />
        )}
      </Section>

      {/* ── Produits ── */}
      <Section title="Produits proposés" icon={PackageCheck}>
        {data.offerings.length === 0 ? (
          <Empty text="Aucun produit n’a encore été relevé chez ce fournisseur." />
        ) : (
          <ul className="grid gap-2">
            {data.offerings.map((offering) => (
              <li key={offering.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{offering.name}</h3>
                      <p className="text-sm text-muted-foreground">{offering.categoryLabel}</p>
                    </div>
                    {/* Un prix ne s'affiche jamais sans sa date de relevé (§2). */}
                    {offering.unitPriceCnyMinor !== null && offering.priceObservedAt && (
                      <div className="text-right">
                        <p className="figures font-semibold">{formatCny(offering.unitPriceCnyMinor)}</p>
                        <p className="figures text-xs text-muted-foreground">
                          relevé le {formatDate(offering.priceObservedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                  {offering.description && <p className="mt-2 text-sm">{offering.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {offering.moq !== null && <Badge tone="neutral">MOQ {offering.moq}</Badge>}
                    {offering.leadTimeDays !== null && <Badge tone="neutral">{offering.leadTimeDays} jours</Badge>}
                    {offering.customizable && <Badge tone="brand">Personnalisable</Badge>}
                    {offering.sampleAvailable && <Badge tone="neutral">Échantillon</Badge>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Conditions commerciales ── */}
      <Section title="Conditions commerciales">
        {data.terms ? (
          <Card>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Item
                label="Commande minimale"
                value={data.terms.minOrderValueCnyMinor ? formatCny(data.terms.minOrderValueCnyMinor) : null}
              />
              <Item
                label="Acompte habituel"
                value={data.terms.depositPercent ? `${data.terms.depositPercent} %` : null}
              />
              <Item
                label="Délai de production"
                value={data.terms.productionLeadTimeDays ? `${data.terms.productionLeadTimeDays} jours` : null}
              />
              <Item
                label="Échantillon"
                value={
                  data.terms.sampleAvailable
                    ? data.terms.sampleCostCnyMinor
                      ? formatCny(data.terms.sampleCostCnyMinor)
                      : 'Disponible'
                    : 'Non disponible'
                }
              />
            </dl>

            {data.terms.paymentTermLabels.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Paiements acceptés</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {data.terms.paymentTermLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.terms.customizationOptions.map((option) => (
                <Badge key={option} tone="brand">
                  {option}
                </Badge>
              ))}
              {data.terms.packagingOptions.map((option) => (
                <Badge key={option} tone="neutral">
                  {option}
                </Badge>
              ))}
              {data.terms.incoterms.map((incoterm) => (
                <Badge key={incoterm} tone="night">
                  {incoterm}
                </Badge>
              ))}
              {data.terms.negotiable && <Badge tone="success">Conditions négociables</Badge>}
            </div>

            {data.terms.checkedAt && (
              <p className="figures mt-3 text-xs text-muted-foreground">
                Conditions relevées le {formatDate(data.terms.checkedAt)}. Elles peuvent avoir changé depuis.
              </p>
            )}
          </Card>
        ) : (
          <Empty text="Les conditions commerciales de ce fournisseur n’ont pas encore été relevées." />
        )}
      </Section>

      {/* ── Documents ── */}
      <Section title="Documents contrôlés" icon={FileText}>
        {data.documents.length === 0 ? (
          <Empty text="Aucun document contrôlé n’est publié pour ce fournisseur." />
        ) : (
          <ul className="grid gap-2">
            {data.documents.map((document) => (
              <li key={document.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{document.label}</p>
                    <p className="figures text-xs text-muted-foreground">
                      {document.kindLabel} · contrôlé le {formatDate(document.verifiedAt)}
                      {document.expiresAt ? ` · valable jusqu’au ${formatDate(document.expiresAt)}` : ''}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Incidents : jamais masqués (§17) ── */}
      <Section title="Incidents connus" icon={AlertTriangle}>
        {data.incidents.length === 0 ? (
          <Empty text="Aucun incident n’a été enregistré à ce jour. Cela ne constitue pas une garantie." />
        ) : (
          <ul className="grid gap-2">
            {data.incidents.map((incident) => (
              <li key={incident.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={incident.severity === 'MINOR' ? 'warning' : 'danger'}>{incident.severityLabel}</Badge>
                    <Badge tone={incident.status === 'RESOLVED' ? 'success' : 'neutral'}>{incident.statusLabel}</Badge>
                    <span className="figures text-xs text-muted-foreground">{formatDate(incident.occurredAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">{incident.summary}</p>
                  {incident.resolution && (
                    <p className="mt-1 text-sm text-muted-foreground">Résolution : {incident.resolution}</p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Commandes test ── */}
      <Section title="Commandes test passées par notre équipe">
        {data.testOrders.length === 0 ? (
          <Empty text="Notre équipe n’a pas encore passé de commande test chez ce fournisseur." />
        ) : (
          <ul className="grid gap-2">
            {data.testOrders.map((order) => (
              <li key={order.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{order.productLabel}</p>
                      <p className="figures text-xs text-muted-foreground">
                        {order.quantity} pièces · commandé le {formatDate(order.orderedAt)}
                        {order.receivedAt ? ` · reçu le ${formatDate(order.receivedAt)}` : ''}
                      </p>
                    </div>
                    <Badge tone={order.outcome === 'CONFORMING' ? 'success' : 'warning'}>{order.outcomeLabel}</Badge>
                  </div>
                  <p className="figures mt-2 text-sm">{formatCny(order.amountCnyMinor)}</p>
                  {order.notes && <p className="mt-1 text-sm text-muted-foreground">{order.notes}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Boutiques en ligne ── */}
      <Section title="Boutiques en ligne" icon={Store}>
        {data.shopLinks.length === 0 ? (
          <Empty text="Aucune boutique en ligne n’a été relevée pour ce fournisseur." />
        ) : (
          <ul className="grid gap-2">
            {data.shopLinks.map((boutique) => (
              <li key={boutique.id}>
                <a
                  href={boutique.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="ws-eleve flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{boutique.label ?? boutique.platformLabel}</span>
                    <span className="block truncate text-xs text-muted-foreground">{boutique.url}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{boutique.platformLabel}</Badge>
                    <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                </a>
                {/*
                  La date de contrôle est dite, ou son absence l'est. Un lien affiché sans
                  rien dire laisse croire qu'il a été ouvert récemment — ce qui est faux.
                */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {boutique.checkedAt
                    ? `Lien vérifié le ${formatDate(boutique.checkedAt)}`
                    : 'Ce lien n’a pas encore été vérifié par notre équipe.'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Photos réelles ── */}
      <Section title="Photos réelles" icon={Camera}>
        {data.photos.length === 0 ? (
          <Empty text="Aucune photo prise par notre équipe n’est encore disponible. Nous n’utilisons pas d’image d’illustration." />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- images hébergées, hors domaines configurés */}
                <img src={photo.url} alt={photo.caption ?? photo.kindLabel} className="h-32 w-full object-cover" />
                <p className="figures px-2 py-1.5 text-xs text-muted-foreground">
                  {photo.kindLabel} · {formatDate(photo.takenAt)}
                  {photo.takenBy ? ` · ${photo.takenBy}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Historique des vérifications ── */}
      {data.proofs.length > 0 && (
        <Section title="Historique des vérifications">
          <Card>
            <ul className="grid gap-3">
              {data.proofs.map((proof) => (
                <li key={proof.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="font-semibold">{proof.levelLabel}</p>
                  <p className="text-sm text-muted-foreground">{proof.meaning}</p>
                  <p className="figures mt-1 text-xs text-muted-foreground">
                    Preuve enregistrée le {formatDate(proof.verifiedAt)}
                  </p>
                  {proof.notes && <p className="mt-1 text-sm">{proof.notes}</p>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Un niveau ne s’obtient jamais sans preuve enregistrée, et ne remplace pas votre propre vérification.
            </p>
          </Card>
        </Section>
      )}

      <p className="text-xs text-muted-foreground">
        <ProvenanceBadge provenance="VERIFIED" className="mr-2 align-middle" />
        Les informations de cette fiche ont été relevées par notre équipe aux dates indiquées. Elles ne remplacent
        pas un échantillon ni une inspection avant expédition.
      </p>
    </Wrapper>
  );
}

/** Coordonnées réservées (§17) : le bouton demande, le serveur décide. */
function ContactSection({ supplierId, granted, reason }: { supplierId: string; granted: boolean; reason: string }) {
  const mutation = useMutation({ mutationFn: () => fetchSupplierContact(supplierId) });

  if (mutation.isSuccess) {
    const contact = mutation.data;
    return (
      <Card>
        <h2 className="font-semibold">Coordonnées</h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <Item label="Contact" value={contact.contactName} />
          <Item label="Téléphone" value={contact.phone} />
          <Item label="WhatsApp" value={contact.whatsapp} />
          <Item label="WeChat" value={contact.wechat} />
          <Item label="Email" value={contact.email} />
          <Item label="Site" value={contact.website} />
          <Item label="Boutique en ligne" value={contact.storeUrl} />
          <Item label="Adresse" value={contact.addressLine} />
        </dl>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-muted">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="font-semibold">Coordonnées du fournisseur</h2>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          {mutation.isError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : 'Les coordonnées n’ont pas pu être affichées.'}
            </p>
          )}
          {granted ? (
            <Button size="sm" className="mt-3" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Afficher les coordonnées
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/tarifs">Voir les offres</Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:px-6 md:py-8">{children}</div>;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  const id = title.toLowerCase().replaceAll(/[^a-z]+/g, '-');
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {Icon && <Icon className="size-4" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Une donnée absente est dite absente : jamais remplacée par une valeur inventée (§54). */
function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${value ? 'figures' : 'text-muted-foreground'}`}>{value ?? 'Non communiqué'}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <Wrapper>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-11 rounded-md" />
        <Skeleton className="h-11 rounded-md" />
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </Wrapper>
  );
}

'use client';

import {
  computeImportCalculation,
  computeShipmentMeasures,
  ImportCalculationInputSchema,
  selectFreightRate,
  SHIPPING_MODE_LABELS,
  SHIPPING_MODES,
  type CargoOptionsResponse,
  type FreightRate,
  type ImportCalculationInput,
  type ImportCalculationResult,
  type ShippingMode,
  type SimulationListResponse,
  type SimulationResponse,
  type SimulationSummaryResponse,
} from '@ws/contracts';
import { Button, Card, Money, Progress, ProvenanceBadge } from '@ws/ui';
import { ArrowLeft, ArrowRight, Copy, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { apiFetch } from '@/lib/auth-client';
import { ChampNombre, ChampTexte, Option, Pastille, Section } from './champs';
import { Comparaison, DetailDesPostes, OrigineDuFret, Rentabilite, TotalColle } from './resultat';

const ETAPES = ['Votre produit', 'Votre colis', 'Votre transitaire', 'Frais et taxes'] as const;

type CoutPersonnalise = { label: string; amount: number };

/**
 * Calculateur d'importation (CALC-04).
 * Le calcul tourne dans le navigateur pour un résultat immédiat, à partir des mêmes
 * règles que le serveur (@ws/contracts) et des tarifs réellement saisis (lot CARGO).
 * À la sauvegarde, le serveur recalcule : c'est lui qui fait foi.
 */
export function CalculateurView() {
  const [etape, setEtape] = useState(0);

  const [quantity, setQuantity] = useState(100);
  const [unitPurchasePrice, setUnitPurchasePrice] = useState(2_000);
  const [unitSellingPrice, setUnitSellingPrice] = useState(0);

  const [mode, setMode] = useState<ShippingMode>('SEA');
  const [cartons, setCartons] = useState(1);
  const [weightKgPerCarton, setWeightKgPerCarton] = useState(20);
  const [lengthCm, setLengthCm] = useState(60);
  const [widthCm, setWidthCm] = useState(40);
  const [heightCm, setHeightCm] = useState(40);

  const [forwarderId, setForwarderId] = useState<string | null>(null);
  const [freightOverride, setFreightOverride] = useState(0);

  const [chinaInlandTransport, setChinaInlandTransport] = useState(0);
  const [inspection, setInspection] = useState(0);
  const [packaging, setPackaging] = useState(0);
  const [insuranceRatePercent, setInsuranceRatePercent] = useState(0);
  const [serviceFeePercent, setServiceFeePercent] = useState(0);
  const [customsDutyPercent, setCustomsDutyPercent] = useState(0);
  const [vatPercent, setVatPercent] = useState(0);
  const [autresCouts, setAutresCouts] = useState<CoutPersonnalise[]>([]);

  const [transitaires, setTransitaires] = useState<CargoOptionsResponse['forwarders'] | null>(null);
  const [simulations, setSimulations] = useState<SimulationSummaryResponse[] | null>(null);
  const [nom, setNom] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Les tarifs disponibles sont publics : ils alimentent le choix du transitaire.
    apiFetch<CargoOptionsResponse>('/cargo/options')
      .then((data) => setTransitaires(data.forwarders))
      .catch(() => setTransitaires([]));
  }, []);

  const chargerSimulations = useCallback(() => {
    // Un échec signifie simplement que personne n'est connecté : pas d'erreur affichée.
    apiFetch<SimulationListResponse>('/calculator/simulations')
      .then((data) => setSimulations(data.simulations))
      .catch(() => setSimulations(null));
  }, []);

  useEffect(() => chargerSimulations(), [chargerSimulations]);

  const transitaireChoisi = transitaires?.find((item) => item.id === forwarderId) ?? null;

  /** Grilles du transitaire choisi, converties pour le moteur de calcul. */
  const rates = useMemo<FreightRate[]>(
    () =>
      (transitaireChoisi?.rates ?? []).map((rate) => ({
        ...rate,
        forwarderName: transitaireChoisi?.name,
        effectiveFrom: new Date(rate.effectiveFrom),
      })),
    [transitaireChoisi],
  );

  const input = useMemo<ImportCalculationInput>(
    () => ({
      quantity,
      unitPurchasePrice,
      mode,
      parcels:
        cartons > 0 && weightKgPerCarton > 0 && lengthCm > 0 && widthCm > 0 && heightCm > 0
          ? [{ cartons, weightKgPerCarton, lengthCm, widthCm, heightCm }]
          : [],
      forwarderId: forwarderId ?? undefined,
      freightOverride: freightOverride > 0 ? freightOverride : undefined,
      chinaInlandTransport,
      inspection,
      packaging,
      insuranceRatePercent,
      serviceFeePercent,
      customsDutyPercent,
      vatPercent,
      otherCosts: autresCouts.filter((cout) => cout.label.trim() !== '' && cout.amount > 0),
      unitSellingPrice: unitSellingPrice > 0 ? unitSellingPrice : undefined,
    }),
    [
      quantity,
      unitPurchasePrice,
      mode,
      cartons,
      weightKgPerCarton,
      lengthCm,
      widthCm,
      heightCm,
      forwarderId,
      freightOverride,
      chinaInlandTransport,
      inspection,
      packaging,
      insuranceRatePercent,
      serviceFeePercent,
      customsDutyPercent,
      vatPercent,
      autresCouts,
      unitSellingPrice,
    ],
  );

  const comparison = useMemo(
    () => SHIPPING_MODES.map((item) => calculer(input, item, rates)).filter(estUnResultat),
    [input, rates],
  );
  const result = comparison.find((item) => item.mode === mode) ?? null;

  function reprendre(simulation: SimulationResponse) {
    const repris = ImportCalculationInputSchema.parse(simulation.input);
    setQuantity(repris.quantity);
    setUnitPurchasePrice(repris.unitPurchasePrice);
    setUnitSellingPrice(repris.unitSellingPrice ?? 0);
    setMode(repris.mode);
    const colis = repris.parcels[0];
    if (colis) {
      setCartons(colis.cartons);
      setWeightKgPerCarton(colis.weightKgPerCarton);
      setLengthCm(colis.lengthCm);
      setWidthCm(colis.widthCm);
      setHeightCm(colis.heightCm);
    }
    setForwarderId(repris.forwarderId ?? null);
    setFreightOverride(repris.freightOverride ?? 0);
    setChinaInlandTransport(repris.chinaInlandTransport);
    setInspection(repris.inspection);
    setPackaging(repris.packaging);
    setInsuranceRatePercent(repris.insuranceRatePercent);
    setServiceFeePercent(repris.serviceFeePercent);
    setCustomsDutyPercent(repris.customsDutyPercent);
    setVatPercent(repris.vatPercent);
    setAutresCouts(repris.otherCosts);
    setNom(simulation.label);
    setEtape(ETAPES.length - 1);
    setMessage(null);
  }

  async function sauvegarder() {
    setMessage(null);
    setEnregistrement(true);
    try {
      await apiFetch<SimulationResponse>('/calculator/simulations', {
        method: 'POST',
        body: JSON.stringify({ label: nom.trim() || 'Ma simulation', input }),
      });
      setMessage('Simulation enregistrée. Vous la retrouverez ici à tout moment.');
      chargerSimulations();
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  }

  async function agirSurSimulation(id: string, action: 'duplication' | 'suppression') {
    setMessage(null);
    try {
      if (action === 'duplication') {
        await apiFetch(`/calculator/simulations/${id}/duplication`, { method: 'POST' });
      } else {
        await apiFetch(`/calculator/simulations/${id}`, { method: 'DELETE' });
      }
      chargerSimulations();
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : 'Action impossible.');
    }
  }

  async function ouvrir(id: string) {
    setMessage(null);
    try {
      reprendre(await apiFetch<SimulationResponse>(`/calculator/simulations/${id}`));
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : 'Simulation introuvable.');
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-4 md:px-6 md:py-6">
      <TotalColle result={result} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">Calculateur d’importation</h1>
          <ProvenanceBadge provenance="ESTIMATE" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Chaque montant est une estimation calculée à partir de vos hypothèses et des tarifs
          enregistrés. Ce n’est pas un devis.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Étape {etape + 1} sur {ETAPES.length} · {ETAPES[etape]}
          </span>
        </div>
        <Progress value={((etape + 1) / ETAPES.length) * 100} />
      </div>

      <Card className="p-5">
        {etape === 0 && (
          <Section titre="Votre produit" aide="Le prix d’achat est celui payé au fournisseur en Chine.">
            <ChampNombre
              id="quantite"
              label="Quantité à importer"
              value={quantity}
              onChange={setQuantity}
              suffixe="unités"
              min={1}
            />
            <ChampNombre
              id="prix-achat"
              label="Prix d’achat unitaire"
              value={unitPurchasePrice}
              onChange={setUnitPurchasePrice}
              suffixe="FCFA"
            />
            <ChampNombre
              id="prix-vente"
              label="Prix de vente envisagé (facultatif)"
              value={unitSellingPrice}
              onChange={setUnitSellingPrice}
              suffixe="FCFA"
              aide="Renseigné, il affiche votre marge, votre ROI et votre seuil de rentabilité."
            />
          </Section>
        )}

        {etape === 1 && (
          <Section
            titre="Votre colis"
            aide="Le transport se facture au poids facturable : le plus élevé du poids réel et du poids volumétrique."
          >
            <div className="flex flex-wrap gap-2">
              {SHIPPING_MODES.map((item) => (
                <Pastille key={item} selected={mode === item} onClick={() => setMode(item)}>
                  {SHIPPING_MODE_LABELS[item]}
                </Pastille>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChampNombre id="cartons" label="Nombre de cartons" value={cartons} onChange={setCartons} min={1} />
              <ChampNombre
                id="poids"
                label="Poids d’un carton"
                value={weightKgPerCarton}
                onChange={setWeightKgPerCarton}
                suffixe="kg"
                pas={0.1}
              />
              <ChampNombre id="longueur" label="Longueur" value={lengthCm} onChange={setLengthCm} suffixe="cm" />
              <ChampNombre id="largeur" label="Largeur" value={widthCm} onChange={setWidthCm} suffixe="cm" />
              <ChampNombre id="hauteur" label="Hauteur" value={heightCm} onChange={setHeightCm} suffixe="cm" />
            </div>
            {result && (
              <p className="rounded-md bg-surface-muted p-3 text-sm text-muted-foreground">
                Poids réel {result.measures.realWeightKg} kg · poids volumétrique{' '}
                {result.measures.volumetricWeightKg} kg · volume {result.measures.volumeM3} m³ →{' '}
                <span className="font-semibold text-foreground">
                  {result.measures.chargeableWeightKg} kg facturables
                </span>
              </p>
            )}
          </Section>
        )}

        {etape === 2 && (
          <Section
            titre="Votre transitaire"
            aide="Choisissez un transitaire pour utiliser ses tarifs réels, avec leur date d’entrée en vigueur."
          >
            <div className="grid gap-2">
              <Option
                titre="Je n’ai pas encore de transitaire"
                description="Nous utilisons une fourchette estimative, datée et sourcée."
                selected={forwarderId === null}
                onClick={() => setForwarderId(null)}
              />
              {(transitaires ?? []).map((item) => (
                <Option
                  key={item.id}
                  titre={item.name}
                  description={`${item.modes.map((m) => SHIPPING_MODE_LABELS[m]).join(' · ')}${
                    item.cities.length > 0 ? ` — ${item.cities.join(', ')}` : ''
                  }`}
                  selected={forwarderId === item.id}
                  onClick={() => setForwarderId(item.id)}
                />
              ))}
            </div>
            {transitaires !== null && transitaires.length === 0 && (
              <p className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                Aucun transitaire n’est encore enregistré sur la plateforme. Le calcul repose donc sur
                une fourchette d’estimation, que vous pouvez remplacer par un montant négocié.
              </p>
            )}
            <ChampNombre
              id="fret-manuel"
              label="Fret déjà négocié (facultatif)"
              value={freightOverride}
              onChange={setFreightOverride}
              suffixe="FCFA"
              aide="Laissez à zéro pour utiliser le tarif du transitaire ou la fourchette d’estimation."
            />
          </Section>
        )}

        {etape === 3 && (
          <Section titre="Frais et taxes" aide="Laissez à zéro ce que vous ne payez pas.">
            <div className="grid gap-3 md:grid-cols-2">
              <ChampNombre
                id="transport-chine"
                label="Transport interne en Chine"
                value={chinaInlandTransport}
                onChange={setChinaInlandTransport}
                suffixe="FCFA"
              />
              <ChampNombre
                id="inspection"
                label="Inspection"
                value={inspection}
                onChange={setInspection}
                suffixe="FCFA"
              />
              <ChampNombre
                id="packaging"
                label="Packaging"
                value={packaging}
                onChange={setPackaging}
                suffixe="FCFA"
              />
              <ChampNombre
                id="assurance"
                label="Assurance"
                value={insuranceRatePercent}
                onChange={setInsuranceRatePercent}
                suffixe="% marchandise"
                max={100}
                pas={0.25}
              />
              <ChampNombre
                id="service"
                label="Frais de service"
                value={serviceFeePercent}
                onChange={setServiceFeePercent}
                suffixe="% marchandise"
                max={100}
                pas={0.5}
              />
              <ChampNombre
                id="douane"
                label="Droits de douane estimés"
                value={customsDutyPercent}
                onChange={setCustomsDutyPercent}
                suffixe="% valeur CAF"
                max={100}
                pas={0.5}
              />
              <ChampNombre
                id="tva"
                label="TVA estimée"
                value={vatPercent}
                onChange={setVatPercent}
                suffixe="% valeur CAF"
                max={100}
                pas={0.25}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Les taux de douane dépendent de la catégorie du produit : confirmez-les auprès de votre
              transitaire ou des douanes avant de vous engager.
            </p>

            <div className="grid gap-2">
              {autresCouts.map((cout, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <ChampTexte
                      id={`cout-label-${index}`}
                      label="Autre coût"
                      value={cout.label}
                      onChange={(value) => modifier(setAutresCouts, index, { ...cout, label: value })}
                      placeholder="Transport Douala → Yaoundé"
                    />
                  </div>
                  <div className="w-32">
                    <ChampNombre
                      id={`cout-montant-${index}`}
                      label="Montant"
                      value={cout.amount}
                      onChange={(value) => modifier(setAutresCouts, index, { ...cout, amount: value })}
                      suffixe="FCFA"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Retirer ce coût"
                    onClick={() => setAutresCouts((liste) => liste.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setAutresCouts((liste) => [...liste, { label: '', amount: 0 }])}
              >
                <Plus aria-hidden />
                Ajouter un coût
              </Button>
            </div>
          </Section>
        )}

        <div className="mt-6 flex items-center gap-2">
          {etape > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setEtape(etape - 1)}>
              <ArrowLeft aria-hidden />
              Retour
            </Button>
          )}
          {etape < ETAPES.length - 1 && (
            <Button type="button" size="lg" block onClick={() => setEtape(etape + 1)}>
              Continuer
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </Card>

      {result && etape >= 2 && <OrigineDuFret result={result} />}

      {result && etape === ETAPES.length - 1 && (
        <>
          <Comparaison comparison={comparison} modeChoisi={mode} onChoisir={setMode} />
          <DetailDesPostes result={result} />
          <Rentabilite result={result} />

          <Card>
            <h3 className="text-base font-semibold">Garder cette simulation</h3>
            {simulations === null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <Link href="/connexion" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Connectez-vous
                </Link>{' '}
                pour enregistrer vos simulations et les retrouver plus tard.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <ChampTexte
                  id="nom-simulation"
                  label="Nom de la simulation"
                  value={nom}
                  onChange={setNom}
                  placeholder="Montres connectées — 100 pièces"
                />
                <Button type="button" size="lg" loading={enregistrement} onClick={() => void sauvegarder()}>
                  <Save aria-hidden />
                  Sauvegarder
                </Button>
              </div>
            )}
            {message && (
              <p role="status" className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-sm">
                {message}
              </p>
            )}
          </Card>
        </>
      )}

      {simulations !== null && simulations.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold">Mes simulations</h3>
          <ul className="mt-3 grid gap-2">
            {simulations.map((simulation) => (
              <li
                key={simulation.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{simulation.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {SHIPPING_MODE_LABELS[simulation.mode]} · {simulation.quantity} unités ·{' '}
                    <Money value={{ amountMinor: simulation.totalXaf, currency: 'XAF' }} />
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => void ouvrir(simulation.id)}>
                    <RotateCcw aria-hidden />
                    Reprendre
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Dupliquer cette simulation"
                    onClick={() => void agirSurSimulation(simulation.id, 'duplication')}
                  >
                    <Copy aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer cette simulation"
                    onClick={() => void agirSurSimulation(simulation.id, 'suppression')}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Calcul d'un mode donné. Une saisie incomplète ne doit jamais casser l'écran. */
function calculer(
  input: ImportCalculationInput,
  mode: ShippingMode,
  rates: FreightRate[],
): ImportCalculationResult | null {
  try {
    const measures = computeShipmentMeasures(input.parcels ?? [], mode);
    const rate = selectFreightRate(rates, { mode, chargeableWeightKg: measures.chargeableWeightKg });
    return computeImportCalculation(
      {
        ...input,
        mode,
        // Un fret négocié ne vaut que pour le mode choisi.
        freightOverride: mode === input.mode ? input.freightOverride : undefined,
      },
      { rate },
    );
  } catch {
    return null;
  }
}

function estUnResultat(value: ImportCalculationResult | null): value is ImportCalculationResult {
  return value !== null;
}

function modifier<T>(
  setter: Dispatch<SetStateAction<T[]>>,
  index: number,
  valeur: T,
): void {
  setter((liste) => liste.map((item, i) => (i === index ? valeur : item)));
}

import { SHIPMENT_STAGE_LABELS, SHIPMENT_STAGES, type ShipmentStage } from '@ws/contracts';
import type { CSSProperties } from 'react';
import { RouteMap } from '@/components/route-map';

/** Où se situe chaque étape sur le schéma : côté Chine, en route, ou côté Cameroun. */
const ZONES: { label: string; stages: ShipmentStage[] }[] = [
  {
    label: 'Chine',
    stages: [
      'ORDER_PAID',
      'SUPPLIER_CONFIRMED',
      'IN_PRODUCTION',
      'SHIPPED_TO_WAREHOUSE',
      'AT_CHINA_WAREHOUSE',
      'INSPECTION',
      'CONSOLIDATION',
    ],
  },
  { label: 'En route', stages: ['IN_TRANSIT'] },
  {
    label: 'Cameroun',
    stages: ['ARRIVED_CAMEROON', 'CUSTOMS', 'AT_LOCAL_WAREHOUSE', 'READY_FOR_PICKUP', 'DELIVERED'],
  },
];

/**
 * Carte stylisée Chine → Cameroun (réutilise le SVG de l'accueil) avec l'étape actuelle.
 * C'est un schéma d'étapes réelles, pas une position GPS : aucune géolocalisation n'est simulée (§25).
 */
export function ShipmentRoute({ stage }: { stage: ShipmentStage }) {
  const index = SHIPMENT_STAGES.indexOf(stage);
  const label = `Trajet Chine vers Cameroun, étape actuelle : ${SHIPMENT_STAGE_LABELS[stage]}`;

  return (
    <div className="grid gap-3">
      <div className="rounded-lg bg-night p-3 text-white">
        <RouteMap label={label} />
      </div>

      <ol className="grid grid-cols-3 gap-1" aria-label="Zones du trajet">
        {ZONES.map((zone) => {
          const first = SHIPMENT_STAGES.indexOf(zone.stages[0]!);
          const last = SHIPMENT_STAGES.indexOf(zone.stages[zone.stages.length - 1]!);
          const state = index > last ? 'done' : index >= first ? 'current' : 'upcoming';
          return (
            <li key={zone.label} className="grid gap-1.5">
              <div className="flex gap-0.5" aria-hidden>
                {zone.stages.map((item) => {
                  const position = SHIPMENT_STAGES.indexOf(item);
                  const franchie = position < index;
                  const tone = franchie ? 'bg-gold' : position === index ? 'bg-imperial' : 'bg-border';
                  // Le chemin déjà parcouru se redessine du départ vers l'étape du jour :
                  // le décalage suit l'ordre réel des étapes, pas l'ordre d'affichage.
                  const geste = franchie ? 'ws-barre' : position === index ? 'ws-pouls' : '';
                  return (
                    <span
                      key={item}
                      className={`h-1.5 flex-1 rounded-full ${tone} ${geste}`}
                      style={franchie ? ({ '--ws-delay': `${position * 0.05}s` } as CSSProperties) : undefined}
                    />
                  );
                })}
              </div>
              <span
                className={`text-xs font-semibold ${
                  state === 'current'
                    ? 'text-imperial'
                    : state === 'done'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {zone.label}
                {state === 'current' && <span className="sr-only"> (zone actuelle)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground">
        Les positions affichées correspondent aux étapes réellement enregistrées par nos équipes,
        pas à une position GPS.
      </p>
    </div>
  );
}

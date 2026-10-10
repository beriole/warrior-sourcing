import { z } from 'zod';

/** Cahier §25 : étapes réelles du suivi, dans l'ordre. Pas de fausse géolocalisation. */
export const SHIPMENT_STAGES = [
  'ORDER_PAID',
  'SUPPLIER_CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED_TO_WAREHOUSE',
  'AT_CHINA_WAREHOUSE',
  'INSPECTION',
  'CONSOLIDATION',
  'IN_TRANSIT',
  'ARRIVED_CAMEROON',
  'CUSTOMS',
  'AT_LOCAL_WAREHOUSE',
  'READY_FOR_PICKUP',
  'DELIVERED',
] as const;
export const ShipmentStageSchema = z.enum(SHIPMENT_STAGES);
export type ShipmentStage = z.infer<typeof ShipmentStageSchema>;

export const SHIPMENT_STAGE_LABELS: Record<ShipmentStage, string> = {
  ORDER_PAID: 'Commande payée',
  SUPPLIER_CONFIRMED: 'Fournisseur confirmé',
  IN_PRODUCTION: 'Production',
  SHIPPED_TO_WAREHOUSE: 'Expédition vers l’entrepôt',
  AT_CHINA_WAREHOUSE: 'Entrepôt Chine',
  INSPECTION: 'Inspection',
  CONSOLIDATION: 'Consolidation',
  IN_TRANSIT: 'Transit',
  ARRIVED_CAMEROON: 'Arrivée au Cameroun',
  CUSTOMS: 'Formalités',
  AT_LOCAL_WAREHOUSE: 'Entrepôt',
  READY_FOR_PICKUP: 'Disponible',
  DELIVERED: 'Livrée',
};

export const SHIPPING_MODES = ['AIR', 'SEA', 'EXPRESS'] as const;
export const ShippingModeSchema = z.enum(SHIPPING_MODES);
export type ShippingMode = z.infer<typeof ShippingModeSchema>;

export const SHIPPING_MODE_LABELS: Record<ShippingMode, string> = {
  AIR: 'Aérien',
  SEA: 'Maritime',
  EXPRESS: 'Express',
};

/** Cahier §38 : résultat d'inspection. */
export const INSPECTION_RESULTS = ['COMPLIANT', 'WITH_RESERVATIONS', 'NON_COMPLIANT'] as const;
export const InspectionResultSchema = z.enum(INSPECTION_RESULTS);
export type InspectionResult = z.infer<typeof InspectionResultSchema>;

export function shipmentProgress(stage: ShipmentStage): number {
  return (SHIPMENT_STAGES.indexOf(stage) + 1) / SHIPMENT_STAGES.length;
}

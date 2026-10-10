import type { ShipmentStage } from '@ws/contracts';

/**
 * Cahier §2 et §54 : l'utilisateur doit toujours savoir quelle est la prochaine action.
 * Fonction pure, donc testable et réutilisable ailleurs (email, notification).
 */
export type NextAction = {
  id: string;
  label: string;
  reason: string;
  href: string;
};

export type NextActionInput = {
  onboardingCompleted: boolean;
  activeOrders: number;
  /** Étape de la commande la plus avancée vers la réception, si elle existe. */
  urgentStage: ShipmentStage | null;
  deliveredOrdersWithoutSales: number;
};

export function computeNextAction(input: NextActionInput): NextAction {
  if (!input.onboardingCompleted) {
    return {
      id: 'onboarding',
      label: 'Compléter mon profil',
      reason: 'Quatre questions suffisent pour adapter les opportunités à votre budget.',
      href: '/onboarding',
    };
  }

  if (input.urgentStage === 'READY_FOR_PICKUP' || input.urgentStage === 'AT_LOCAL_WAREHOUSE') {
    return {
      id: 'pickup',
      label: 'Organiser le retrait',
      reason: 'Votre marchandise est arrivée et vous attend à l’entrepôt.',
      href: '/importations',
    };
  }

  if (input.urgentStage === 'INSPECTION') {
    return {
      id: 'inspection',
      label: 'Voir le rapport d’inspection',
      reason: 'Votre marchandise est en cours de contrôle en Chine.',
      href: '/importations',
    };
  }

  if (input.deliveredOrdersWithoutSales > 0) {
    return {
      id: 'sales',
      label: 'Enregistrer mes ventes',
      reason: 'Mesurez votre marge et suivez la récupération de votre capital.',
      href: '/business-lab',
    };
  }

  if (input.activeOrders > 0) {
    return {
      id: 'tracking',
      label: 'Suivre ma commande',
      reason: 'Vous saurez où se trouve votre marchandise et ce qui vient ensuite.',
      href: '/importations',
    };
  }

  return {
    id: 'calculate',
    label: 'Calculer ma rentabilité',
    reason: 'Partez d’un budget : coût rendu, marge possible et seuil de rentabilité.',
    href: '/calculateur',
  };
}

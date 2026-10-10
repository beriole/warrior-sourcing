import { createElement, type FunctionComponent, type ReactElement } from 'react';
import type { z } from 'zod';
import {
  AccountVerificationEmail,
  AccountVerificationSchema,
  accountVerificationSubject,
} from './templates/account-verification.js';
import { AdminNoticeEmail, AdminNoticeSchema, adminNoticeSubject } from './templates/admin-notice.js';
import {
  CourseAccessGrantedEmail,
  CourseAccessGrantedSchema,
  courseAccessGrantedSubject,
} from './templates/course-access-granted.js';
import { CourseProgressEmail, CourseProgressSchema, courseProgressSubject } from './templates/course-progress.js';
import {
  DeliveryCompletedEmail,
  DeliveryCompletedSchema,
  deliveryCompletedSubject,
} from './templates/delivery-completed.js';
import { OrderConfirmedEmail, OrderConfirmedSchema, orderConfirmedSubject } from './templates/order-confirmed.js';
import {
  PaymentConfirmedEmail,
  PaymentConfirmedSchema,
  paymentConfirmedSubject,
} from './templates/payment-confirmed.js';
import { ShipmentUpdateEmail, ShipmentUpdateSchema, shipmentUpdateSubject } from './templates/shipment-update.js';
import { SourcingResultEmail, SourcingResultSchema, sourcingResultSubject } from './templates/sourcing-result.js';
import {
  SubscriptionActivatedEmail,
  SubscriptionActivatedSchema,
  subscriptionActivatedSubject,
} from './templates/subscription-activated.js';
import { WelcomeEmail, WelcomeSchema, welcomeSubject } from './templates/welcome.js';

export type EmailCategory = 'compte' | 'commande' | 'logistique' | 'sourcing' | 'academy' | 'administratif';

export type EmailDefinition = {
  name: string;
  category: EmailCategory;
  /** Description courte, affichée dans la prévisualisation. */
  description: string;
  /** Jeux de données de démonstration, dont les cas limites. */
  fixtures: Record<string, unknown>;
  /** Valide les données (valeurs par défaut incluses) puis construit sujet et contenu. */
  build(input?: unknown): { subject: string; element: ReactElement };
};

function define<S extends z.ZodObject>(config: {
  name: string;
  category: EmailCategory;
  description: string;
  schema: S;
  subject: (props: z.output<S>) => string;
  Component: (props: z.output<S>) => ReactElement;
  fixtures: Record<string, z.input<S>>;
}): EmailDefinition {
  const { schema, subject } = config;
  const Component = config.Component as FunctionComponent<z.output<S>>;

  return {
    name: config.name,
    category: config.category,
    description: config.description,
    fixtures: config.fixtures,
    build(input?: unknown) {
      // parse() applique les valeurs par défaut : un email reste complet même avec {}.
      const props = schema.parse(input ?? {}) as z.output<S>;
      return { subject: subject(props), element: createElement(Component, props) };
    },
  };
}

const NOW = new Date('2026-09-18T14:32:00+01:00');

/**
 * Catalogue des emails. Ajouter un type = ajouter une entrée ici et un fichier de template :
 * l'envoi, la prévisualisation et les tests le prennent en compte automatiquement.
 */
export const EMAILS = {
  'account-verification': define({
    name: 'Confirmation d’inscription',
    category: 'compte',
    description: 'Code à 6 chiffres envoyé à la création du compte.',
    schema: AccountVerificationSchema,
    subject: accountVerificationSubject,
    Component: AccountVerificationEmail,
    fixtures: {
      Standard: { firstName: 'Bériole', code: '482 195', expiresInMinutes: 10 },
      'Données minimales': {},
    },
  }),

  welcome: define({
    name: 'Bienvenue',
    category: 'compte',
    description: 'Email de référence, envoyé après l’onboarding.',
    schema: WelcomeSchema,
    subject: welcomeSubject,
    Component: WelcomeEmail,
    fixtures: {
      'Importateur débutant': {
        firstName: 'Bériole',
        nextStepLabel: 'Voir les produits sous 300 000 FCFA',
      },
      'Prénom très long': {
        firstName: 'Marie-Emmanuelle Ngo Bikoï Tsagué Djeumé',
        nextStepLabel: 'Choisir une première opportunité',
      },
      'Données minimales': {},
    },
  }),

  'payment-confirmed': define({
    name: 'Paiement confirmé',
    category: 'commande',
    description: 'Accusé de paiement Mobile Money ou carte, avec suite des opérations.',
    schema: PaymentConfirmedSchema,
    subject: paymentConfirmedSubject,
    Component: PaymentConfirmedEmail,
    fixtures: {
      'Paiement MTN MoMo': {
        firstName: 'Bériole',
        orderReference: '#WR-209184',
        transactionReference: 'MP260918.1432.A47219',
        amount: { amountMinor: 247_000, currency: 'XAF' },
        method: 'MTN_MOMO',
        paidAt: NOW,
        productLabel: 'Chargeurs GaN 65W',
        quantity: 120,
      },
      'Montant important': {
        firstName: 'Bériole',
        orderReference: '#WR-209190',
        transactionReference: 'OM260918.0915.B90233',
        amount: { amountMinor: 18_750_000, currency: 'XAF' },
        method: 'ORANGE_MONEY',
        paidAt: NOW,
        productLabel: 'Machines de production',
        quantity: 4,
      },
      'Données minimales': {},
    },
  }),

  'order-confirmed': define({
    name: 'Commande confirmée',
    category: 'commande',
    description: 'Récapitulatif de commande et étape suivante.',
    schema: OrderConfirmedSchema,
    subject: orderConfirmedSubject,
    Component: OrderConfirmedEmail,
    fixtures: {
      'Commande standard': {
        firstName: 'Bériole',
        orderReference: '#WR-209184',
        createdAt: NOW,
        lines: [
          { label: 'Chargeur GaN 65W — noir', quantity: 120, unitPrice: { amountMinor: 1_650, currency: 'XAF' } },
          { label: 'Câble USB-C tressé 1 m', quantity: 200, unitPrice: { amountMinor: 240, currency: 'XAF' } },
        ],
        total: { amountMinor: 247_000, currency: 'XAF' },
        city: 'Douala',
        deliveryMode: 'Retrait en entrepôt',
        estimatedArrival: 'Entre le 12 et le 20 octobre 2026',
      },
      'Sans détail d’articles': {
        firstName: 'Bériole',
        orderReference: '#WR-209212',
        createdAt: NOW,
        total: { amountMinor: 96_500, currency: 'XAF' },
        city: 'Yaoundé',
      },
      'Données minimales': {},
    },
  }),

  'shipment-update': define({
    name: 'Suivi logistique',
    category: 'logistique',
    description: 'Changement d’étape d’une commande, de Guangzhou à Douala.',
    schema: ShipmentUpdateSchema,
    subject: shipmentUpdateSubject,
    Component: ShipmentUpdateEmail,
    fixtures: {
      'Transit international': {
        firstName: 'Bériole',
        orderReference: '#WR-209184',
        stage: 'IN_TRANSIT',
        eventDescription: 'Votre colis a quitté l’entrepôt de Guangzhou et voyage vers Douala.',
        eventAt: NOW,
        trackingCode: 'WS-CM-77401',
        currentLocation: 'Guangzhou',
        destination: 'Douala',
      },
      'Inspection en cours': {
        firstName: 'Bériole',
        orderReference: '#WR-209184',
        stage: 'INSPECTION',
        eventDescription: 'Nos agents inspectent votre marchandise : photos, quantité et défauts éventuels.',
        eventAt: NOW,
        trackingCode: 'WS-CM-77401',
      },
      'Données minimales': {},
    },
  }),

  'delivery-completed': define({
    name: 'Réception confirmée',
    category: 'logistique',
    description: 'Marchandise remise au client, passage au suivi des ventes.',
    schema: DeliveryCompletedSchema,
    subject: deliveryCompletedSubject,
    Component: DeliveryCompletedEmail,
    fixtures: {
      'Livraison Douala': {
        firstName: 'Bériole',
        orderReference: '#WR-209184',
        productLabel: 'Vos 120 chargeurs GaN 65W',
        quantity: 120,
        deliveredAt: NOW,
        pickupPoint: 'Entrepôt Akwa, Douala',
        investedAmount: { amountMinor: 247_000, currency: 'XAF' },
        unitLandedCost: { amountMinor: 2_059, currency: 'XAF' },
        inspectionReportUrl: 'https://warrior-sourcing.cm/commandes/WR-209184/inspection',
      },
      'Données minimales': {},
    },
  }),

  'sourcing-result': define({
    name: 'Résultat de sourcing',
    category: 'sourcing',
    description: 'Propositions de fournisseurs pour une demande personnalisée.',
    schema: SourcingResultSchema,
    subject: sourcingResultSubject,
    Component: SourcingResultEmail,
    fixtures: {
      '3 fournisseurs': {
        firstName: 'Bériole',
        requestReference: '#SR-4471',
        productLabel: 'Chargeurs GaN 65W',
        targetQuantity: '500 pièces',
        requestedAt: new Date('2026-09-12T09:00:00+01:00'),
        suppliers: [
          {
            name: 'Shenzhen Hanyu Electronics',
            city: 'Shenzhen, Guangdong',
            level: 'QUALITY_TESTED',
            moq: '300 pièces',
            price: '1 480 FCFA / pièce',
            leadTime: '12 jours',
          },
          {
            name: 'Guangzhou Leadpower',
            city: 'Guangzhou, Guangdong',
            level: 'SUPPLIER_TESTED',
            moq: '500 pièces',
            price: '1 390 FCFA / pièce',
            leadTime: '18 jours',
          },
          {
            name: 'Dongguan Vertex Tech',
            city: 'Dongguan, Guangdong',
            level: 'IDENTITY_VERIFIED',
            moq: '200 pièces',
            price: '1 620 FCFA / pièce',
            leadTime: '9 jours',
          },
        ],
      },
      'Recherche en cours': {
        firstName: 'Bériole',
        requestReference: '#SR-4482',
        productLabel: 'Presse hydraulique 20 tonnes',
        targetQuantity: '2 unités',
        requestedAt: NOW,
        suppliers: [],
      },
      'Données minimales': {},
    },
  }),

  'course-access-granted': define({
    name: 'Accès à une formation',
    category: 'academy',
    description:
      'Confirmation d’achat d’une formation à l’unité. Porte les identifiants quand le compte vient d’être créé par le paiement.',
    schema: CourseAccessGrantedSchema,
    subject: courseAccessGrantedSubject,
    Component: CourseAccessGrantedEmail,
    fixtures: {
      'Compte créé par l’achat': {
        firstName: 'Bériole',
        courseTitle: 'Trouver un produit et son fournisseur',
        amount: { amountMinor: 15_000, currency: 'XAF' },
        lessonCount: 4,
        email: 'berioletsague@gmail.com',
        password: 'KQPM-7TXR-J94Z-HVDN',
        courseUrl: 'https://warrior-sourcing.cm/academy/trouver-un-produit',
      },
      'Compte déjà existant': {
        firstName: 'Bériole',
        courseTitle: 'Passer la douane au Cameroun',
        amount: { amountMinor: 10_000, currency: 'XAF' },
        lessonCount: 3,
        email: 'berioletsague@gmail.com',
      },
      'Données minimales': {},
    },
  }),

  'course-progress': define({
    name: 'Progression de formation',
    category: 'academy',
    description: 'Relance Academy avec progression et prochaine leçon.',
    schema: CourseProgressSchema,
    subject: courseProgressSubject,
    Component: CourseProgressEmail,
    fixtures: {
      'Formation 1688': {
        firstName: 'Bériole',
        courseTitle: 'Importer depuis 1688',
        progressPercent: 68,
        nextLessonTitle: 'Négocier le prix et les conditions',
        nextLessonDuration: '11 minutes',
        remainingLessons: 4,
        resources: ['Checklist de négociation (PDF)', 'Modèle de fiche produit', 'Grille de comparaison fournisseurs'],
        hasQuiz: true,
      },
      'Début de parcours': {
        firstName: 'Bériole',
        courseTitle: 'Les bases de l’importation Chine → Cameroun',
        progressPercent: 8,
        nextLessonTitle: 'Comprendre le coût rendu',
        nextLessonDuration: '7 minutes',
        remainingLessons: 12,
      },
      'Données minimales': {},
    },
  }),

  'subscription-activated': define({
    name: 'Abonnement actif',
    category: 'compte',
    description:
      'Confirmation d’abonnement. Porte les identifiants de connexion quand le compte vient d’être créé par le paiement.',
    schema: SubscriptionActivatedSchema,
    subject: subscriptionActivatedSubject,
    Component: SubscriptionActivatedEmail,
    fixtures: {
      'Compte créé par le paiement': {
        firstName: 'Bériole',
        planName: 'Pro',
        amount: { amountMinor: 10_000, currency: 'XAF' },
        endsAt: new Date('2026-10-18T14:32:00+01:00'),
        email: 'berioletsague@gmail.com',
        password: 'Kora7-Massa-Neuf',
        rights: ['Coordonnées des fournisseurs vérifiés', 'Simulations enregistrées sans limite'],
        loginUrl: 'https://warrior-sourcing.cm/connexion',
      },
      'Compte déjà existant': {
        firstName: 'Bériole',
        planName: 'Business',
        amount: { amountMinor: 25_000, currency: 'XAF' },
        endsAt: new Date('2026-10-18T14:32:00+01:00'),
        email: 'berioletsague@gmail.com',
        rights: ['Formations de l’Academy incluses', 'Messages traités en priorité'],
      },
      'Données minimales': {},
    },
  }),

  'admin-notice': define({
    name: 'Message administratif',
    category: 'administratif',
    description: 'Compte, abonnement, conditions ou incident.',
    schema: AdminNoticeSchema,
    subject: adminNoticeSubject,
    Component: AdminNoticeEmail,
    fixtures: {
      'Action requise': {
        firstName: 'Bériole',
        title: 'Complétez vos informations de facturation',
        severity: 'action',
        paragraphs: [
          'Pour émettre vos reçus au nom de votre entreprise, il nous manque votre numéro de contribuable et votre adresse de facturation.',
          'Cette information reste privée et ne sert qu’à vos documents comptables.',
        ],
        details: [
          { label: 'Compte', value: 'berioletsague@gmail.com' },
          { label: 'À fournir avant le', value: '30 septembre 2026' },
        ],
        ctaLabel: 'Compléter mon profil',
        ctaUrl: 'https://warrior-sourcing.cm/profil',
      },
      'Contenu long': {
        firstName: 'Bériole',
        title: 'Mise à jour de nos conditions de service',
        severity: 'info',
        paragraphs: [
          'Nos conditions évoluent le 1er octobre 2026 afin de préciser le fonctionnement des précommandes, des remboursements et des frais de service.',
          'Les principaux changements concernent le délai de remboursement en cas d’annulation avant confirmation du fournisseur, la répartition des frais d’inspection lorsqu’une marchandise est jugée non conforme, et la durée de conservation des documents liés à vos importations.',
          'Aucune action n’est nécessaire de votre part : la poursuite de votre utilisation de la plateforme vaut acceptation des nouvelles conditions.',
        ],
      },
      'Données minimales': {},
    },
  }),
} satisfies Record<string, EmailDefinition>;

export type EmailKey = keyof typeof EMAILS;
export const EMAIL_KEYS = Object.keys(EMAILS) as EmailKey[];

export function getEmail(key: EmailKey): EmailDefinition {
  return EMAILS[key];
}

export function isEmailKey(value: string): value is EmailKey {
  return Object.hasOwn(EMAILS, value);
}

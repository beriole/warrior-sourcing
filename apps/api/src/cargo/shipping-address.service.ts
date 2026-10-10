import { Injectable } from '@nestjs/common';
import {
  ADDRESS_MISTAKES,
  CLIENT_CODE_ALPHABET,
  CLIENT_CODE_LENGTH,
  SHIPPING_MODE_LABELS,
  type AddressField,
  type ShippingAddress,
  type ShippingAddressResponse,
} from '@ws/contracts';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Assistant d'adresse d'expédition (CARGO-03, §25).
 *
 * Il répond à une question que tout le monde pose à sa première commande : « qu'est-ce que
 * je mets comme adresse ? ». La réponse n'est pas rédigée, elle est **assemblée** : adresse
 * de l'entrepôt saisie en back-office, code client pris sur le compte. Rien n'est engendré.
 *
 * Un assistant qui improviserait une adresse plausible enverrait une marchandise nulle
 * part, et le texte serait d'autant plus convaincant qu'il serait faux.
 */
@Injectable()
export class ShippingAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string): Promise<ShippingAddressResponse> {
    const [clientCode, transitaires] = await Promise.all([
      this.clientCode(userId),
      this.prisma.forwarder.findMany({
        // Un entrepôt sans adresse chinoise n'est pas servi : il n'y a rien à copier, et
        // afficher un bloc à trous apprendrait la mauvaise habitude.
        where: { active: true, NOT: { warehouseAddressZh: null } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      clientCode,
      addresses: transitaires.map((transitaire) => this.bloc(transitaire, clientCode)),
      mistakes: ADDRESS_MISTAKES,
    };
  }

  /**
   * Code client du compte, engendré à la première demande puis stable.
   *
   * La collision est traitée par la contrainte d'unicité, pas par une vérification
   * préalable : entre un `findFirst` et un `create`, deux requêtes concurrentes peuvent
   * tirer le même code et le test ne verrait rien. On réessaie donc sur rejet.
   */
  private async clientCode(userId: string): Promise<string> {
    const profil = await this.prisma.importerProfile.findUnique({
      where: { userId },
      select: { clientCode: true },
    });
    if (profil?.clientCode) return profil.clientCode;

    for (let essai = 0; essai < 5; essai += 1) {
      const code = engendrerCode();
      try {
        await this.prisma.importerProfile.upsert({
          where: { userId },
          // Le profil d'importateur n'existe pas tant que l'accueil n'a pas été fait : on
          // le crée avec des valeurs neutres plutôt que de refuser une adresse à quelqu'un
          // qui a sauté l'étape.
          create: { userId, level: 'BEGINNER', budgetRange: 'UNDER_100K', clientCode: code },
          update: { clientCode: code },
        });
        return code;
      } catch {
        // Code déjà pris : on retire.
      }
    }

    throw new Error('Impossible d’engendrer un code client unique.');
  }

  private bloc(
    transitaire: {
      id: string;
      name: string;
      cities: string[];
      modes: ('SEA' | 'AIR' | 'EXPRESS')[];
      warehouseName: string | null;
      warehouseAddressZh: string | null;
      warehouseAddressLatin: string | null;
      warehouseContactName: string | null;
      warehousePhone: string | null;
      warehouseInstructions: string | null;
    },
    clientCode: string,
  ): ShippingAddress {
    const destinataire = transitaire.warehouseContactName ?? transitaire.warehouseName ?? transitaire.name;

    const fields: AddressField[] = [
      {
        label: '收件人',
        labelFr: 'Destinataire',
        // Le code client va **dans** le nom du destinataire : c'est le seul champ que tous
        // les vendeurs recopient, et celui que l'entrepôt lit en premier.
        value: `${destinataire} ${clientCode}`,
        why: 'Votre code client doit suivre le nom : c’est lui qui rattache le colis à votre compte.',
        critique: true,
      },
      {
        label: '电话',
        labelFr: 'Téléphone',
        value: transitaire.warehousePhone ?? '',
        why: 'Numéro chinois du destinataire. Le transporteur local appelle ce numéro, pas le vôtre.',
        critique: true,
      },
      {
        label: '地址',
        labelFr: 'Adresse',
        value: transitaire.warehouseAddressZh ?? '',
        why: 'À coller telle quelle, en caractères chinois. C’est cette version que le transporteur lit.',
        critique: true,
      },
    ];

    if (transitaire.warehouseAddressLatin) {
      fields.push({
        label: 'Address (latin)',
        labelFr: 'Adresse en lettres latines',
        value: transitaire.warehouseAddressLatin,
        why: 'Pour relire votre saisie. Ne remplace jamais la version chinoise.',
        critique: false,
      });
    }

    return {
      forwarderId: transitaire.id,
      forwarderName: transitaire.name,
      warehouseName: transitaire.warehouseName ?? transitaire.name,
      modes: transitaire.modes,
      modeLabels: transitaire.modes.map((mode) => SHIPPING_MODE_LABELS[mode]),
      cities: transitaire.cities,
      fields,
      copyBlock: fields
        .filter((champ) => champ.value)
        .map((champ) => `${champ.label}: ${champ.value}`)
        .join('\n'),
      instructions: transitaire.warehouseInstructions,
    };
  }
}

/**
 * `randomInt` plutôt qu'un modulo sur des octets : le modulo favorise légèrement le début
 * de l'alphabet, et il n'y a aucune raison d'accepter ce biais sur un identifiant.
 */
function engendrerCode(): string {
  let suite = '';
  for (let i = 0; i < CLIENT_CODE_LENGTH; i += 1) {
    suite += CLIENT_CODE_ALPHABET[randomInt(CLIENT_CODE_ALPHABET.length)];
  }
  return `WS-${suite}`;
}

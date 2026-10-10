import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Auth } from './auth.config.js';
import { AUTH } from './auth.tokens.js';

/**
 * Création de compte et identifiants engendrés par le serveur (§43).
 *
 * Sert au parcours « je paie un abonnement avant d'avoir un compte » : le compte est
 * créé au moment du paiement, et son mot de passe n'est fabriqué qu'à la confirmation
 * de l'encaissement. Le mot de passe en clair ne quitte jamais cette classe autrement
 * que par sa valeur de retour : il n'est ni journalisé, ni stocké, ni récupérable. Si
 * le courriel qui le porte est perdu, la connexion par code à six chiffres reste
 * ouverte — c'est elle, et non ce mot de passe, qui est le chemin de secours.
 */
@Injectable()
export class AccountProvisioning {
  private readonly logger = new Logger(AccountProvisioning.name);

  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Compte correspondant à cette adresse, créé s'il n'en existe pas.
   *
   * Le mot de passe posé à la création est jeté sans être lu par personne : il rend le
   * compte inutilisable par mot de passe jusqu'à ce qu'un vrai soit engendré. Un compte
   * créé mais non payé n'ouvre donc aucun accès, ce qui est exactement ce qu'on veut.
   */
  async ensure(input: { email: string; name: string }): Promise<{
    user: { id: string; name: string; email: string };
    created: boolean;
  }> {
    const email = input.email.trim().toLowerCase();
    const existant = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    if (existant) return { user: existant, created: false };

    const nom = input.name.trim().slice(0, 80);
    await this.auth.api.signUpEmail({
      body: { email, name: nom, password: generatePassword() },
    });

    // On relit en base plutôt que de se fier à la réponse : c'est la ligne réellement
    // écrite, avec son identifiant définitif et le rôle appliqué par défaut.
    const cree = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    if (!cree) {
      // Ne devrait pas arriver : signUpEmail lève en cas d'échec. Mieux vaut une erreur
      // franche qu'un abonnement rattaché à rien.
      throw new Error(`Le compte ${email} n’a pas été créé.`);
    }

    this.logger.log(`Compte créé pour une souscription publique : ${email}`);
    return { user: cree, created: true };
  }

  /**
   * Engendre un mot de passe pour ce compte, l'écrit haché, et le renvoie en clair une
   * seule fois. Le hachage est celui de Better Auth : la connexion par mot de passe
   * fonctionne ensuite sans traitement particulier.
   */
  async issuePassword(userId: string): Promise<string> {
    const motDePasse = generatePassword();
    const ctx = await this.auth.$context;
    const hache = await ctx.password.hash(motDePasse);

    // `updatePassword` écrit sur le compte « credential » et ne crée rien. Un compte né
    // d'une connexion par code email n'en a pas : sans ce garde-fou, on enverrait un
    // mot de passe qui ne fonctionnerait jamais, sans la moindre erreur visible.
    const credential = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { id: true },
    });
    if (!credential) {
      await ctx.internalAdapter.createAccount({
        userId,
        providerId: 'credential',
        accountId: userId,
        password: hache,
      });
      return motDePasse;
    }

    await ctx.internalAdapter.updatePassword(userId, hache);
    return motDePasse;
  }
}

/**
 * Alphabet sans caractère ambigu : ni O/0, ni I/l/1. Un mot de passe recopié depuis un
 * courriel sur le clavier d'un téléphone n'a pas droit à l'erreur de lecture.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPES = 4;
const PAR_GROUPE = 4;

/**
 * Mot de passe engendré : 16 caractères tirés au sort, groupés par quatre.
 *
 * `randomInt` plutôt qu'un modulo sur des octets : le modulo favorise légèrement le
 * début de l'alphabet, et il n'y a aucune raison d'accepter ce biais ici.
 */
export function generatePassword(): string {
  const groupes: string[] = [];
  for (let g = 0; g < GROUPES; g += 1) {
    let groupe = '';
    for (let i = 0; i < PAR_GROUPE; i += 1) groupe += ALPHABET[randomInt(ALPHABET.length)];
    groupes.push(groupe);
  }
  return groupes.join('-');
}

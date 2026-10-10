import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/**
 * Passerelle unique vers le fournisseur de modèles (DEC-08 : OpenRouter).
 *
 * Tout ce qui appelle un modèle de langue passe par ici. Deux raisons, et la seconde est
 * la plus importante :
 *
 * 1. Le modèle est nommé dans la configuration. En changer ne demande pas un déploiement.
 * 2. **Les garde-fous sont posés à un seul endroit.** Une consigne de prudence recopiée
 *    dans trois services finit par diverger, et c'est la copie oubliée qui inventera un
 *    prix. Ici, la consigne système est préfixée à chaque appel, sans exception possible.
 *
 * Sans clé, la passerelle se déclare indisponible et ne lève rien au démarrage : une
 * plateforme ne doit pas tomber parce qu'un assistant n'est pas configuré.
 */
@Injectable()
export class OpenRouterGateway {
  private readonly logger = new Logger(OpenRouterGateway.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** Vrai quand une clé est configurée. L'interface s'en sert pour ne rien proposer sinon. */
  get disponible(): boolean {
    return Boolean(this.config.get('OPENROUTER_API_KEY', { infer: true }));
  }

  get modele(): string {
    return this.config.get('OPENROUTER_MODEL', { infer: true });
  }

  /**
   * Une réponse du modèle, en texte.
   *
   * `context` contient les faits **relevés dans notre base** que le modèle a le droit
   * d'utiliser. Il n'a aucun accès à autre chose : c'est ce qui permet d'exiger de lui
   * qu'il ne cite aucun chiffre absent de ce bloc.
   */
  async repondre(input: {
    consigne: string;
    context: string;
    historique: { role: 'user' | 'assistant'; content: string }[];
    question: string;
    /** Plafond de jetons produits. Une réponse d'assistant doit être courte. */
    maxTokens?: number;
  }): Promise<string> {
    const cle = this.config.get('OPENROUTER_API_KEY', { infer: true });
    if (!cle) {
      throw new ServiceUnavailableException({
        message: 'L’assistant n’est pas disponible pour le moment.',
        code: 'ai_unavailable',
      });
    }

    const corps = {
      model: this.modele,
      // Volontairement bas : on veut des réponses stables et prudentes, pas créatives.
      temperature: 0.2,
      max_tokens: input.maxTokens ?? 700,
      /*
       * Raisonnement coupé, et ce n'est pas une économie de bout de chandelle : les
       * modèles récents le consomment sur le **même** budget que la réponse. Mesuré ici
       * avant de l'écrire — avec 500 jetons, les 500 partaient en raisonnement et la
       * réponse revenait vide, sans erreur. Une réponse d'assistant de six phrases, qui
       * ne fait que reformuler des faits déjà relevés, n'en a aucun besoin.
       */
      reasoning: { enabled: false },
      messages: [
        { role: 'system' as const, content: `${GARDE_FOUS}\n\n${input.consigne}` },
        { role: 'system' as const, content: `Faits relevés dans la base :\n${input.context}` },
        ...input.historique,
        { role: 'user' as const, content: input.question },
      ],
    };

    let reponse: Response;
    try {
      reponse = await fetch(`${this.config.get('OPENROUTER_BASE_URL', { infer: true })}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cle}`,
          // Demandé par OpenRouter pour identifier l'application appelante.
          'HTTP-Referer': this.config.get('APP_URL', { infer: true }),
          'X-Title': 'Warrior Sourcing',
        },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      this.logger.error(`OpenRouter injoignable : ${describeError(error)}`);
      throw new ServiceUnavailableException({
        message: 'L’assistant n’a pas répondu. Réessayez dans un instant.',
        code: 'ai_unreachable',
      });
    }

    const texte = await reponse.text();
    if (!reponse.ok) {
      // La clé ne doit jamais se retrouver dans un journal : seul l'état et le corps y vont.
      this.logger.warn(`OpenRouter → ${reponse.status} : ${texte.slice(0, 300)}`);
      throw new ServiceUnavailableException({
        message: 'L’assistant n’a pas pu répondre.',
        code: 'ai_refused',
      });
    }

    const contenu = extraireContenu(texte);
    if (!contenu) {
      this.logger.warn('Réponse OpenRouter sans contenu exploitable.');
      throw new ServiceUnavailableException({
        message: 'L’assistant n’a rien renvoyé d’exploitable.',
        code: 'ai_empty',
      });
    }

    return contenu;
  }
}

/**
 * Consigne posée avant toute autre, sur chaque appel.
 *
 * Elle reprend les règles du produit (§54) parce qu'un modèle de langue est précisément
 * l'endroit où elles risquent le plus d'être enfreintes : il produit sans effort un prix
 * plausible, un délai rassurant ou un bénéfice chiffré, et rien dans sa sortie ne signale
 * que c'était une invention.
 *
 * Ce n'est pas une garantie — aucune consigne n'en est une. C'est pourquoi les chiffres
 * qui engagent (prix, fret, droits) ne viennent jamais du modèle dans ce produit : ils
 * viennent du calculateur et des grilles saisies, et l'assistant y renvoie.
 */
const GARDE_FOUS = `Tu es l'assistant de Warrior Sourcing, une plateforme qui accompagne des importateurs camerounais qui achètent en Chine.

Règles absolues :
- Tu ne cites AUCUN chiffre qui ne figure pas dans les faits relevés fournis. Pas de prix, pas de délai, pas de taux de douane, pas de frais. Si on t'en demande un que tu n'as pas, tu le dis et tu renvoies vers le calculateur ou vers l'équipe.
- Tu ne promets JAMAIS un bénéfice, une marge, une rentabilité ou un délai. Tu peux expliquer comment les estimer.
- Tu ne donnes jamais d'adresse d'entrepôt, de coordonnées de fournisseur ni de code client : ces informations ont leurs propres écrans, qui vérifient les droits d'accès.
- Tu ne présentes jamais une estimation comme une certitude. Quand une information est une estimation, tu le dis.
- Si tu ne sais pas, tu le dis en une phrase et tu orientes vers la page ou l'équipe concernée.

Ton : direct, concret, en français. Des phrases courtes. Pas de formules commerciales, pas d'enthousiasme de brochure. Tu t'adresses à quelqu'un qui engage son argent.`;

function extraireContenu(texte: string): string | null {
  try {
    const data = JSON.parse(texte) as { choices?: { message?: { content?: unknown } }[] };
    const contenu = data.choices?.[0]?.message?.content;
    return typeof contenu === 'string' && contenu.trim() ? contenu.trim() : null;
  } catch {
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

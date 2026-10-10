import { Injectable } from '@nestjs/common';
import {
  SEARCH_ENTITY_TYPES,
  SEARCH_ENTITY_TYPE_LABELS,
  SEARCH_MIN_SCORE,
  SEARCH_PER_TYPE,
  type GlobalSearchQuery,
  type GlobalSearchResponse,
  type SearchEntityType,
  type SearchHit,
} from '@ws/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Une ligne telle que la requête SQL la renvoie, avant mise en forme. */
type LigneTrouvee = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  score: number;
};

/**
 * Recherche globale (PLAT-08, §36).
 *
 * Pourquoi des trigrammes plutôt qu'une recherche plein texte : nos utilisateurs tapent
 * sur un clavier de téléphone, souvent sans accents et parfois de travers. « telefone »
 * doit trouver « téléphone ». La recherche plein texte de PostgreSQL normalise bien les
 * mots mais ne pardonne pas une faute de frappe ; `word_similarity` de `pg_trgm`, lui,
 * mesure une ressemblance — et `unaccent` règle la question des accents une fois pour
 * toutes, dans les deux sens.
 *
 * Le classement se fait sur la ressemblance mesurée, et les résultats sous
 * `SEARCH_MIN_SCORE` ne sont pas servis : mieux vaut ne rien proposer que proposer du
 * bruit, qui donnerait l'impression d'un catalogue plus riche qu'il n'est (§54).
 *
 * Les quatre familles sont interrogées séparément plutôt qu'en une union : chaque table
 * a ses propres règles de visibilité (un produit doit être publié, un fournisseur non),
 * et les mélanger dans une seule requête rendrait ces règles invisibles.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Texte réellement cherché : réduit, sans accents, tel qu'il part en base. */
  private normaliser(q: string): string {
    return q
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  private async produits(q: string, limite: number): Promise<LigneTrouvee[]> {
    return this.prisma.$queryRaw<LigneTrouvee[]>`
      SELECT id, slug, name AS title, description AS subtitle,
             GREATEST(
               word_similarity(unaccent(${q}), unaccent(lower(name))),
               word_similarity(unaccent(${q}), unaccent(lower(description)))
             )::float8 AS score
      FROM product
      WHERE status = 'PUBLISHED'
        AND GREATEST(
              word_similarity(unaccent(${q}), unaccent(lower(name))),
              word_similarity(unaccent(${q}), unaccent(lower(description)))
            ) >= ${SEARCH_MIN_SCORE}
      ORDER BY score DESC, name ASC
      LIMIT ${limite}`;
  }

  private async fournisseurs(q: string, limite: number): Promise<LigneTrouvee[]> {
    // Le fournisseur n'a pas d'identifiant d'URL : son identifiant technique en tient lieu.
    return this.prisma.$queryRaw<LigneTrouvee[]>`
      SELECT id, id AS slug, name AS title, "publicSummary" AS subtitle,
             GREATEST(
               word_similarity(unaccent(${q}), unaccent(lower(name))),
               word_similarity(unaccent(${q}), unaccent(lower(COALESCE("publicSummary", ''))))
             )::float8 AS score
      FROM supplier
      WHERE GREATEST(
              word_similarity(unaccent(${q}), unaccent(lower(name))),
              word_similarity(unaccent(${q}), unaccent(lower(COALESCE("publicSummary", ''))))
            ) >= ${SEARCH_MIN_SCORE}
      ORDER BY score DESC, name ASC
      LIMIT ${limite}`;
  }

  private async formations(q: string, limite: number): Promise<LigneTrouvee[]> {
    return this.prisma.$queryRaw<LigneTrouvee[]>`
      SELECT id, slug, title, summary AS subtitle,
             GREATEST(
               word_similarity(unaccent(${q}), unaccent(lower(title))),
               word_similarity(unaccent(${q}), unaccent(lower(summary)))
             )::float8 AS score
      FROM course
      WHERE "publishedAt" IS NOT NULL
        AND GREATEST(
              word_similarity(unaccent(${q}), unaccent(lower(title))),
              word_similarity(unaccent(${q}), unaccent(lower(summary)))
            ) >= ${SEARCH_MIN_SCORE}
      ORDER BY score DESC, title ASC
      LIMIT ${limite}`;
  }

  private async prestations(q: string, limite: number): Promise<LigneTrouvee[]> {
    return this.prisma.$queryRaw<LigneTrouvee[]>`
      SELECT id, slug, name AS title, summary AS subtitle,
             GREATEST(
               word_similarity(unaccent(${q}), unaccent(lower(name))),
               word_similarity(unaccent(${q}), unaccent(lower(summary)))
             )::float8 AS score
      FROM service_offering
      WHERE "publishedAt" IS NOT NULL
        AND GREATEST(
              word_similarity(unaccent(${q}), unaccent(lower(name))),
              word_similarity(unaccent(${q}), unaccent(lower(summary)))
            ) >= ${SEARCH_MIN_SCORE}
      ORDER BY score DESC, name ASC
      LIMIT ${limite}`;
  }

  /** Chemin d'ouverture d'une fiche dans le site, connu ici et nulle part ailleurs. */
  static href(type: SearchEntityType, slug: string): string {
    switch (type) {
      case 'PRODUCT':
        return `/opportunites/${slug}`;
      case 'SUPPLIER':
        return `/fournisseurs/${slug}`;
      case 'COURSE':
        return `/academy/${slug}`;
      case 'SERVICE':
        return `/services/${slug}`;
    }
  }

  private async pourType(type: SearchEntityType, q: string, limite: number): Promise<LigneTrouvee[]> {
    switch (type) {
      case 'PRODUCT':
        return this.produits(q, limite);
      case 'SUPPLIER':
        return this.fournisseurs(q, limite);
      case 'COURSE':
        return this.formations(q, limite);
      case 'SERVICE':
        return this.prestations(q, limite);
    }
  }

  async search(query: GlobalSearchQuery): Promise<GlobalSearchResponse> {
    const q = this.normaliser(query.q);
    const familles = query.type ? [query.type] : [...SEARCH_ENTITY_TYPES];
    // Sans famille imposée, on prend un petit paquet par famille : la page de résultats
    // doit montrer qu'il existe des formations même quand dix produits correspondent.
    const parFamille = query.type ? query.limit : SEARCH_PER_TYPE;

    const paquets = await Promise.all(
      familles.map(async (type) => ({ type, lignes: await this.pourType(type, q, parFamille) })),
    );

    const items: SearchHit[] = paquets
      .flatMap(({ type, lignes }) =>
        lignes.map((ligne) => ({
          type,
          typeLabel: SEARCH_ENTITY_TYPE_LABELS[type].label,
          id: ligne.id,
          slug: ligne.slug,
          title: ligne.title,
          // Une ligne de contexte, raccourcie proprement : jamais une phrase inventée.
          subtitle: ligne.subtitle ? abreger(ligne.subtitle) : null,
          href: SearchService.href(type, ligne.slug),
          score: Number(ligne.score),
        })),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);

    return {
      query: q,
      total: items.length,
      items,
      counts: familles
        .map((type) => ({
          type,
          label: SEARCH_ENTITY_TYPE_LABELS[type].plural,
          count: items.filter((item) => item.type === type).length,
        }))
        .filter((compte) => compte.count > 0),
    };
  }
}

/** Première phrase, ou première centaine de caractères : de quoi situer, pas de quoi lire. */
function abreger(texte: string, maximum = 120): string {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (propre.length <= maximum) return propre;
  return `${propre.slice(0, maximum - 1).trimEnd()}…`;
}

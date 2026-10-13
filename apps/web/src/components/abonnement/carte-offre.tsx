import { SUBSCRIPTION_RIGHT_LABELS, type SubscriptionPlan } from '@ws/contracts';
import { Card, ConditionsPromotion, Prix } from '@ws/ui';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Carte d'une offre d'abonnement, partagée par la page d'accueil et `/abonnement`.
 *
 * Elle vit ici plutôt qu'en double parce que les deux écrans annonçaient les mêmes prix
 * avec deux mises en page différentes : la première divergence de style passe inaperçue,
 * la première divergence de prix ne pardonne pas.
 *
 * ## Ce qui a changé
 *
 * **« Gratuit » s'écrivait deux fois** — une fois comme nom de l'offre, une fois à la place
 * du prix. Le montant d'une offre gratuite s'affiche désormais « 0 FCFA » : la colonne des
 * prix reste alignée d'une carte à l'autre, et le mot ne fait plus écho à lui-même.
 *
 * **Les droits étaient une phrase.** « Droits ouverts : Coordonnées des fournisseurs,
 * Simulations illimitées. » en bas de carte, en petit gris, ressemblait à une sortie de
 * débogage. Ce sont des pastilles, qui se lisent d'un coup d'œil.
 *
 * **L'offre mise en avant est sombre.** Trois cartes blanches dont une bordée de rouge se
 * ressemblent trop pour qu'on distingue laquelle est recommandée. Le fond nuit et l'accent
 * or la détachent sans qu'on ait à l'écrire.
 *
 * Le prix affiché reste celui du serveur, remise comprise, et le prix barré reste le prix
 * réellement pratiqué (§54) : c'est `Prix` qui tient ces règles, et rien n'est recalculé ici.
 *
 * L'action est passée en `enfant` plutôt que construite ici : la page d'accueil pose un
 * lien vers `/abonnement`, la page d'abonnement ouvre un formulaire de paiement, et une
 * carte n'a pas à connaître la différence.
 */
export function CarteOffre({
  plan,
  enAvant,
  libelleEnAvant,
  badge,
  action,
}: {
  plan: SubscriptionPlan;
  enAvant: boolean;
  libelleEnAvant: string;
  /** Pastille d'état, par exemple « Votre offre » sur la page d'abonnement. */
  badge?: ReactNode;
  action: ReactNode;
}) {
  // Gratuite au sens plein : aucun prix, aucune promotion. Une offre tombée à zéro par une
  // promotion n'entre pas ici — son prix barré doit rester visible.
  const vraimentGratuite = plan.priceXaf === 0 && plan.priced.originalXaf === 0;

  return (
    <Card
      className={`ws-eleve relative flex h-full flex-col overflow-hidden p-0 ${
        enAvant ? 'border-night bg-night text-white shadow-raised' : 'bg-surface'
      }`}
    >
      {/* Filet d'accent : il donne un rang aux trois cartes avant même qu'on les lise. */}
      <span
        aria-hidden
        className={`h-1 w-full ${enAvant ? 'bg-gold' : vraimentGratuite ? 'bg-border' : 'bg-imperial'}`}
      />

      <div className="flex flex-1 flex-col gap-5 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-bold tracking-tight">{plan.name}</h3>
            {enAvant && (
              <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-night uppercase">
                {libelleEnAvant}
              </span>
            )}
            {badge}
          </div>
          <p className={`mt-1 text-sm ${enAvant ? 'text-white/70' : 'text-muted-foreground'}`}>{plan.tagline}</p>
        </div>

        <div>
          <p className="flex flex-wrap items-baseline gap-x-2">
            {vraimentGratuite ? (
              <span className="font-display text-4xl font-bold tracking-tight">0 FCFA</span>
            ) : (
              <Prix priced={plan.priced} taille="geante" />
            )}
            {plan.priceXaf > 0 && (
              <span className={`text-sm ${enAvant ? 'text-white/60' : 'text-muted-foreground'}`}>
                {plan.periodSuffix}
              </span>
            )}
          </p>
          <ConditionsPromotion
            priced={plan.priced}
            className={`mt-1 block ${enAvant ? 'text-white/60' : ''}`}
          />
        </div>

        <ul className="grid flex-1 content-start gap-2.5 text-sm">
          {plan.highlights.map((avantage) => (
            <li key={avantage} className="flex items-start gap-2.5">
              <Check
                className={`mt-0.5 size-4 shrink-0 ${enAvant ? 'text-gold' : 'text-success'}`}
                aria-hidden
              />
              <span className={enAvant ? 'text-white/90' : ''}>{avantage}</span>
            </li>
          ))}
        </ul>

        {plan.rights.length > 0 && (
          <div>
            <p className={`text-[11px] font-semibold tracking-wide uppercase ${enAvant ? 'text-white/50' : 'text-muted-foreground'}`}>
              Droits ouverts
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {plan.rights.map((droit) => (
                <li
                  key={droit}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    enAvant ? 'bg-white/10 text-white/80' : 'bg-surface-muted text-muted-foreground'
                  }`}
                >
                  {SUBSCRIPTION_RIGHT_LABELS[droit].label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Les actions sont collées en bas : trois cartes de hauteurs différentes
            alignent quand même leurs boutons, et l'œil compare ce qui est comparable. */}
        <div className="mt-auto pt-1">{action}</div>
      </div>
    </Card>
  );
}

/**
 * Offre mise en avant : celle qui ouvre le plus de droits. À égalité de droits, la
 * moins chère — mettre en avant la plus chère à avantages égaux serait trompeur.
 * Rien n'est mis en avant s'il n'existe qu'une offre, ou si aucune n'ouvre de droit.
 */
export function aMettreEnAvant(plans: SubscriptionPlan[]): string | null {
  if (plans.length < 2) return null;

  const candidates = plans.filter((plan) => plan.rights.length > 0);
  if (candidates.length === 0) return null;

  return candidates.reduce((meilleure, plan) => {
    if (plan.rights.length > meilleure.rights.length) return plan;
    if (plan.rights.length === meilleure.rights.length && plan.priceXaf < meilleure.priceXaf) return plan;
    return meilleure;
  }).id;
}

import { Card, Entree } from '@ws/ui';
import { BookOpen, Calculator, LifeBuoy, Mail, Ship } from 'lucide-react';
import Link from 'next/link';

/**
 * Aide (§45).
 *
 * Les réponses portent sur ce que la plateforme fait réellement aujourd'hui. Rien n'y
 * décrit une fonction à venir comme si elle existait, et chaque question renvoie à
 * l'écran qui la traite plutôt que de répéter son contenu.
 *
 * Le contact est une adresse email et non un formulaire : la messagerie interne n'est pas
 * encore ouverte, et un formulaire qui n'aboutirait nulle part serait pire qu'une adresse.
 */
const QUESTIONS: { question: string; reponse: string; lien?: { href: string; label: string } }[] = [
  {
    question: 'Pourquoi un coût est-il annoncé comme une estimation ?',
    reponse:
      'Parce qu’il en est une. Le fret dépend du poids facturable réel, les droits de douane du classement retenu à l’arrivée, et le taux de change du jour du paiement. Chaque chiffre affiché porte sa nature et, quand il vient d’un relevé, sa date et sa source. Nous préférons une fourchette honnête à un chiffre rond et faux.',
    lien: { href: '/calculateur', label: 'Ouvrir le calculateur' },
  },
  {
    question: 'Que veut dire le badge d’un fournisseur ?',
    reponse:
      'Chaque niveau dit précisément ce qui a été contrôlé : identité vérifiée, fournisseur testé, qualité testée, partenaire. Aucun badge ne s’affiche sans une preuve enregistrée et datée. Un fournisseur sans badge n’est pas mauvais : il n’a simplement pas encore été contrôlé, et c’est écrit tel quel.',
    lien: { href: '/fournisseurs', label: 'Voir les fournisseurs' },
  },
  {
    question: 'Pourquoi certains produits n’affichent-ils pas de marge ?',
    reponse:
      'Parce que leur prix de vente local n’a pas encore été relevé. Sans ce prix, toute marge serait inventée. La fiche affiche alors « pas encore relevé » plutôt qu’un pourcentage rassurant.',
    lien: { href: '/opportunites', label: 'Voir les opportunités' },
  },
  {
    question: 'Comment se passe le paiement ?',
    reponse:
      'La demande de paiement est poussée sur votre téléphone, et vous la validez avec votre code Mobile Money. Aucune page extérieure à ouvrir, aucun numéro de carte à saisir. Tant que le paiement n’est pas confirmé par l’opérateur, votre commande reste en attente et rien n’est engagé.',
    lien: { href: '/importations', label: 'Suivre mes importations' },
  },
  {
    question: 'Où en est ma commande ?',
    reponse:
      'Chaque étape affichée correspond à un événement réellement enregistré par nos équipes : paiement reçu, production, inspection, départ, arrivée, douane, retrait. Ce n’est pas une position GPS, et aucune étape n’est anticipée.',
    lien: { href: '/importations', label: 'Suivre mes importations' },
  },
  {
    question: 'À quoi servent les questions de l’inscription ?',
    reponse:
      'À filtrer ce qu’on vous montre : votre budget écarte les opportunités hors de portée, vos catégories remontent celles qui vous concernent. Vous pouvez revoir vos réponses à tout moment depuis votre profil.',
    lien: { href: '/profil', label: 'Voir mon profil' },
  },
];

const PARCOURS: { href: string; icon: typeof BookOpen; titre: string; texte: string }[] = [
  { href: '/academy', icon: BookOpen, titre: 'Apprendre', texte: 'Formations courtes sur chaque étape.' },
  { href: '/calculateur', icon: Calculator, titre: 'Calculer', texte: 'Coût rendu, marge, seuil de rentabilité.' },
  { href: '/services', icon: LifeBuoy, titre: 'Déléguer', texte: 'Recherche, inspection, transport.' },
  { href: '/importations', icon: Ship, titre: 'Suivre', texte: 'Vos colis, étape par étape.' },
];

export function AideView() {
  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <Entree geste="paragraphe" as="header">
        <h1 className="font-display text-2xl font-bold tracking-tight">Aide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les questions qui reviennent, et ce que nos chiffres veulent dire exactement.
        </p>
      </Entree>

      <section className="grid gap-2 sm:grid-cols-2">
        {PARCOURS.map(({ href, icon: Icon, titre, texte }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{titre}</span>
              <span className="block text-sm text-muted-foreground">{texte}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Questions fréquentes</h2>
        {QUESTIONS.map(({ question, reponse, lien }) => (
          <Card key={question} className="ws-onview" suppressHydrationWarning>
            <h3 className="font-semibold">{question}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{reponse}</p>
            {lien && (
              <Link
                href={lien.href}
                className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
              >
                {lien.label}
              </Link>
            )}
          </Card>
        ))}
      </section>

      <Card className="ws-onview" suppressHydrationWarning>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="size-4 text-muted-foreground" aria-hidden />
          Nous écrire
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          La messagerie interne n’est pas encore ouverte. En attendant, écrivez-nous à{' '}
          <a href="mailto:berioletsague@gmail.com" className="font-semibold text-primary hover:underline">
            berioletsague@gmail.com
          </a>
          . Si votre question porte sur une commande, indiquez sa référence : elle commence par WS- ou SRV-.
        </p>
      </Card>
    </div>
  );
}

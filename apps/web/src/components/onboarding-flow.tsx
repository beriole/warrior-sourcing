'use client';

import {
  BUDGET_RANGES,
  IMPORTER_GOAL_LABELS,
  IMPORTER_LEVEL_LABELS,
  ImporterProfileSchema,
  INTEREST_CATEGORY_LABELS,
  type BudgetRangeId,
  type ImporterGoal,
  type ImporterLevel,
  type InterestCategory,
} from '@ws/contracts';
import { Button, Card, Progress, TransitionEtape } from '@ws/ui';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/auth-client';

const STEPS = ['Votre nom', 'Votre expérience', 'Votre objectif', 'Votre budget', 'Vos catégories'] as const;

const BUDGET_LABELS: Record<BudgetRangeId, string> = {
  UNDER_100K: 'Moins de 100 000 FCFA',
  FROM_100K_TO_300K: '100 000 à 300 000 FCFA',
  FROM_300K_TO_1M: '300 000 à 1 000 000 FCFA',
  FROM_1M_TO_5M: '1 à 5 millions FCFA',
  OVER_5M: 'Plus de 5 millions FCFA',
};

/**
 * Onboarding (§10) : peu de saisie, forte valeur. Les réponses personnalisent l'accueil
 * et les recommandations.
 *
 * La première question demande le nom. La connexion se fait par email et code : rien n'y
 * recueille comment la personne s'appelle, si bien qu'un compte frais a un nom vide. Sans
 * cette étape, l'email de bienvenue, le tableau de bord et les échanges avec l'équipe
 * s'adressent à personne.
 */
export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  // Avancer et revenir ne sont pas le même geste : le sens du glissement le dit.
  const [sens, setSens] = useState<'avant' | 'arriere'>('avant');

  function allerA(prochaine: number) {
    setSens(prochaine > step ? 'avant' : 'arriere');
    setStep(prochaine);
  }
  const [name, setName] = useState('');
  const [level, setLevel] = useState<ImporterLevel | null>(null);
  const [goals, setGoals] = useState<ImporterGoal[]>([]);
  const [budgetRange, setBudget] = useState<BudgetRangeId | null>(null);
  const [interests, setInterests] = useState<InterestCategory[]>([]);
  const [city, setCity] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canContinue = [
    name.trim().length >= 2,
    level !== null,
    goals.length > 0,
    budgetRange !== null,
    interests.length > 0,
  ][step];

  async function save() {
    setError(null);
    const parsed = ImporterProfileSchema.safeParse({
      name,
      level,
      goals,
      budgetRange,
      interests,
      city: city.trim() || undefined,
    });

    if (!parsed.success) {
      setError('Il manque une réponse. Revenez en arrière pour compléter.');
      return;
    }

    setPending(true);
    try {
      await apiFetch('/me/profile', { method: 'PUT', body: JSON.stringify(parsed.data) });
      setDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible. Réessayez.');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">Votre espace est prêt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos opportunités et vos recommandations tiennent désormais compte de votre budget et de vos catégories.
        </p>
        <Button asChild size="lg" block className="mt-6">
          <Link href="/tableau-de-bord">
            Découvrir ma plateforme
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-5 md:p-6">
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Étape {step + 1} sur {STEPS.length}
          </span>
          <span className="figures text-xs text-muted-foreground">{Math.round(((step + 1) / STEPS.length) * 100)} %</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <TransitionEtape etape={step} sens={sens}>
      <h1 className="font-display text-2xl font-bold tracking-tight">{QUESTIONS[step]}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{HINTS[step]}</p>

      <div className="mt-5 grid gap-2">
        {step === 0 && (
          <>
            <label htmlFor="nom" className="text-xs font-medium text-muted-foreground">
              Nom ou prénom
            </label>
            <input
              id="nom"
              value={name}
              autoFocus
              autoComplete="name"
              maxLength={80}
              placeholder="Marie, ou Marie Ngo"
              onChange={(event) => setName(event.target.value)}
              className="h-12 rounded-md border border-border bg-surface px-3 text-base outline-none focus-visible:border-primary"
            />
          </>
        )}

        {step === 1 &&
          Object.entries(IMPORTER_LEVEL_LABELS).map(([id, label]) => (
            <Choice key={id} selected={level === id} onClick={() => setLevel(id as ImporterLevel)}>
              {label}
            </Choice>
          ))}

        {step === 2 &&
          Object.entries(IMPORTER_GOAL_LABELS).map(([id, label]) => (
            <Choice
              key={id}
              multiple
              selected={goals.includes(id as ImporterGoal)}
              onClick={() => setGoals(toggle(goals, id as ImporterGoal))}
            >
              {label}
            </Choice>
          ))}

        {step === 3 &&
          BUDGET_RANGES.map((range) => (
            <Choice key={range.id} selected={budgetRange === range.id} onClick={() => setBudget(range.id)}>
              {BUDGET_LABELS[range.id]}
            </Choice>
          ))}

        {step === 4 && (
          <>
            <div className="flex flex-wrap gap-2">
              {Object.entries(INTEREST_CATEGORY_LABELS).map(([id, label]) => (
                <Chip
                  key={id}
                  selected={interests.includes(id as InterestCategory)}
                  onClick={() => setInterests(toggle(interests, id as InterestCategory))}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <label htmlFor="city" className="mt-4 text-xs font-medium text-muted-foreground">
              Votre ville (facultatif)
            </label>
            <input
              id="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Douala, Yaoundé, Bafoussam…"
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
            />
          </>
        )}
      </div>
      </TransitionEtape>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        {step > 0 && (
          <Button type="button" variant="outline" size="lg" className="shrink-0" onClick={() => allerA(step - 1)}>
            <ArrowLeft aria-hidden />
            Retour
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          block
          // `block` vaut largeur pleine : dans une rangée, il faut lui permettre
          // de se réduire, sinon il déborde dès que « Retour » apparaît.
          className="min-w-0 flex-1"
          loading={pending}
          disabled={!canContinue}
          onClick={() => (step === STEPS.length - 1 ? void save() : allerA(step + 1))}
        >
          {step === STEPS.length - 1 ? 'Terminer' : 'Continuer'}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </Card>
  );
}

const QUESTIONS = [
  'Comment devons-nous vous appeler ?',
  'Où en êtes-vous dans l’importation ?',
  'Que voulez-vous faire en premier ?',
  'Quel budget pouvez-vous engager ?',
  'Quels produits vous intéressent ?',
] as const;

const HINTS = [
  'Votre nom ou votre prénom : c’est ainsi que nous nous adresserons à vous.',
  'Cela nous aide à doser les explications, sans vous ralentir si vous êtes déjà expérimenté.',
  'Plusieurs réponses possibles.',
  'Nous filtrons les opportunités réellement à votre portée.',
  'Plusieurs réponses possibles.',
] as const;

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function Choice({
  children,
  selected,
  multiple = false,
  onClick,
}: {
  children: string;
  selected: boolean;
  multiple?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${
        selected ? 'border-primary bg-imperial-soft text-imperial-hover' : 'border-border bg-surface hover:bg-surface-muted'
      }`}
    >
      {children}
      <span
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center border ${multiple ? 'rounded-sm' : 'rounded-full'} ${
          selected ? 'border-primary bg-primary text-white' : 'border-border'
        }`}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

function Chip({ children, selected, onClick }: { children: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
        selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}

'use client';

import { Badge, Button, Card, Progress, Skeleton } from '@ws/ui';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { formatDate, useQuiz, useSubmitQuiz } from './academy-client';

/**
 * Quiz de fin de chapitre (ACA-04).
 *
 * Les bonnes réponses n'arrivent qu'avec la correction : avant d'envoyer, l'écran ne sait
 * pas lesquelles sont justes. Le score est celui que le serveur a calculé — rien n'est
 * recalculé ici (§54).
 */
export function QuizPanel({ quizId }: { quizId: string }) {
  const { data, isPending, isError, error, refetch, isRefetching } = useQuiz(quizId);
  const submit = useSubmitQuiz(quizId);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (isPending) {
    return (
      <Card className="grid gap-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <h2 className="font-semibold">Le quiz n’a pas pu être chargé</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.'}
        </p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()} loading={isRefetching}>
          <RefreshCw aria-hidden />
          Réessayer
        </Button>
      </Card>
    );
  }

  const result = submit.data;
  const answered = Object.keys(answers).length;
  const complete = answered === data.questions.length;

  if (result) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{data.title}</h2>
          <Badge tone={result.passed ? 'success' : 'warning'}>{result.passed ? 'Réussi' : 'À retravailler'}</Badge>
        </div>

        <Progress
          className="mt-3"
          value={result.scorePercent}
          aria-label={`Score : ${result.scorePercent} %`}
        />
        <p className="figures mt-1 text-sm">
          {result.correctCount} bonne{result.correctCount > 1 ? 's' : ''} réponse
          {result.correctCount > 1 ? 's' : ''} sur {result.questionCount} — {result.scorePercent} % (
          {result.passScorePercent} % requis)
        </p>

        <ul className="mt-4 grid gap-3">
          {result.corrections.map((correction) => (
            <li key={correction.questionId} className="rounded-md border border-border p-3">
              <p className="flex items-start gap-2 text-sm font-medium">
                {correction.correct ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                )}
                {correction.prompt}
              </p>
              {!correction.correct && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Bonne réponse : <span className="font-semibold">{correction.correctChoiceLabel}</span>
                </p>
              )}
              {correction.explanation && (
                <p className="mt-1 text-sm text-muted-foreground">{correction.explanation}</p>
              )}
            </li>
          ))}
        </ul>

        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => {
            setAnswers({});
            submit.reset();
          }}
        >
          <RefreshCw aria-hidden />
          Refaire le quiz
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-semibold">{data.title}</h2>
      <p className="figures mt-1 text-xs text-muted-foreground">
        {data.questions.length} question{data.questions.length > 1 ? 's' : ''} — {data.passScorePercent} % de bonnes
        réponses pour réussir
      </p>
      {data.lastAttempt && (
        <p className="figures mt-1 text-xs text-muted-foreground">
          Dernière tentative : {data.lastAttempt.scorePercent} % le {formatDate(data.lastAttempt.takenAt)} (
          {data.lastAttempt.passed ? 'réussie' : 'non réussie'})
        </p>
      )}

      <ol className="mt-4 grid gap-4">
        {data.questions.map((question, index) => (
          <li key={question.id}>
            <fieldset>
              <legend className="text-sm font-medium">
                <span className="figures mr-1 text-muted-foreground">{index + 1}.</span>
                {question.prompt}
              </legend>
              <div className="mt-2 grid gap-2">
                {question.choices.map((choice) => {
                  const selected = answers[question.id] === choice.id;
                  return (
                    <label
                      key={choice.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                        selected ? 'border-imperial bg-imperial-soft/50' : 'border-border hover:bg-surface-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={choice.id}
                        checked={selected}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                        className="size-4 shrink-0 accent-imperial"
                      />
                      {choice.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={!complete}
          loading={submit.isPending}
          onClick={() =>
            submit.mutate(
              Object.entries(answers).map(([questionId, choiceId]) => ({ questionId, choiceId })),
            )
          }
        >
          Corriger mes réponses
        </Button>
        {!complete && (
          <span className="figures text-xs text-muted-foreground">
            {answered} / {data.questions.length} question{data.questions.length > 1 ? 's' : ''} répondue
            {answered > 1 ? 's' : ''}
          </span>
        )}
        {submit.isError && (
          <span className="text-xs text-danger">
            {submit.error instanceof Error ? submit.error.message : 'La correction n’a pas abouti.'}
          </span>
        )}
      </div>
    </Card>
  );
}

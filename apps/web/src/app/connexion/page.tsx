import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { SignInFlow } from '@/components/sign-in-flow';

export const metadata: Metadata = {
  title: 'Connexion — Warrior Sourcing',
  description: 'Connectez-vous avec votre numéro de téléphone pour accéder à votre espace d’importation.',
};

export default function SignInPage() {
  return (
    <main data-theme="dark" className="relative min-h-dvh overflow-hidden bg-charcoal text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgb(200_16_46/0.35),transparent_70%)]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <Link href="/" className="mb-8 font-display text-lg font-bold tracking-tight">
          Warrior <span className="text-gold">Sourcing</span>
        </Link>
        {/* `SignInFlow` lit `suite` dans l'adresse : Next exige une frontière de
            suspension autour de tout composant qui lit les paramètres de requête. */}
        <Suspense fallback={<div className="h-80" />}>
          <SignInFlow />
        </Suspense>
      </div>
    </main>
  );
}

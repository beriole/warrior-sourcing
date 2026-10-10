import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/onboarding-flow';

export const metadata: Metadata = {
  title: 'Votre profil d’importateur — Warrior Sourcing',
  description: 'Quatre questions pour adapter les opportunités, les fournisseurs et les formations à votre situation.',
};

export default function OnboardingPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <span className="font-display text-lg font-bold tracking-tight">
          Warrior <span className="text-imperial">Sourcing</span>
        </span>
        <div className="mt-6">
          <OnboardingFlow />
        </div>
      </div>
    </main>
  );
}

'use client';

import { Button, Card } from '@ws/ui';
import { Globe, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';
import { definirLangue } from './actions';

const LANGUES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

/**
 * Paramètres du compte.
 *
 * N'y figure que ce qui agit réellement. Les préférences de notification, par exemple,
 * n'ont pas encore de modèle côté serveur : afficher des interrupteurs qui ne bloquent
 * aucun envoi donnerait une maîtrise qui n'existe pas. Ils sont donc annoncés comme
 * à venir, pas simulés.
 */
export function ParametresView({ locale }: { locale: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [deconnexion, setDeconnexion] = useState(false);

  function changerLangue(code: string) {
    // Le cookie est posé par le serveur : c'est lui qui le relit pour choisir les
    // messages, et le poser là évite un premier rendu dans l'ancienne langue.
    demarrer(async () => {
      await definirLangue(code);
      router.refresh();
    });
  }

  async function seDeconnecter() {
    setDeconnexion(true);
    try {
      await authClient.signOut();
    } finally {
      // Même si l'appel échoue, on quitte l'espace connecté : rester ici après avoir
      // demandé à partir serait le pire des deux états.
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre nom, votre numéro et vos préférences d’importation se modifient depuis votre profil.
        </p>
      </header>

      <Card className="grid gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Globe className="size-4 text-muted-foreground" aria-hidden />
            Langue
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La traduction anglaise ne couvre pour l’instant que la page d’accueil publique. Le reste de
            l’application reste en français : nous préférons le dire plutôt que de vous laisser le découvrir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LANGUES.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => changerLangue(code)}
              aria-pressed={locale === code}
              disabled={enCours}
              className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors ${
                locale === code
                  ? 'border-primary bg-imperial-soft'
                  : 'border-border bg-surface hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold">Pas encore réglable</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces réglages existeront quand la fonction derrière existera. Un interrupteur qui ne coupe rien
            ne vaut pas mieux que pas d’interrupteur.
          </p>
        </div>
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          <li>• Préférences de notification par canal : email, notification sur le téléphone.</li>
          <li>• Moyens de paiement enregistrés et adresses de livraison.</li>
          <li>• Suppression du compte et export de vos données.</li>
        </ul>
      </Card>

      <Card className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold">Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vous resterez connecté sur cet appareil jusqu’à ce que vous vous déconnectiez.
          </p>
        </div>
        <div>
          <Button variant="outline" loading={deconnexion} onClick={() => void seDeconnecter()}>
            <LogOut aria-hidden />
            Me déconnecter
          </Button>
        </div>
      </Card>
    </div>
  );
}

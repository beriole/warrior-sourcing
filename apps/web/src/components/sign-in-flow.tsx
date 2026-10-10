'use client';

import { Button, Card, TransitionEtape } from '@ws/ui';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, authClient } from '@/lib/auth-client';

const CODE_LENGTH = 6;
const RESEND_DELAY_SECONDS = 45;

type Step = 'email' | 'code';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * Connexion en deux temps : adresse email puis code reçu par email (§10).
 * Aucun mot de passe à retenir, et l'adresse sert ensuite aux confirmations de commande.
 */
export function SignInFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  // Le sens du passage : il dit à l'utilisateur s'il avance ou s'il revient.
  const [sens, setSens] = useState<'avant' | 'arriere'>('avant');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function sendCode() {
    setError(null);
    setPending(true);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim().toLowerCase(),
      type: 'sign-in',
    });
    setPending(false);

    if (sendError) {
      setError("Nous n'avons pas pu envoyer le code. Vérifiez l'adresse et réessayez.");
      return;
    }

    setSecondsLeft(RESEND_DELAY_SECONDS);
    setSens('avant');
    setStep('code');
  }

  async function verifyCode() {
    setError(null);
    setPending(true);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email: email.trim().toLowerCase(),
      otp: code,
    });

    if (verifyError) {
      setPending(false);
      setCode('');
      setError('Ce code ne correspond pas. Vérifiez l’email reçu, ou demandez un nouveau code.');
      return;
    }

    // L'onboarding n'est demandé qu'une fois : on lit l'état côté serveur.
    const me = await apiFetch<{ onboardingCompleted: boolean }>('/me').catch(() => null);
    router.push(me?.onboardingCompleted ? '/tableau-de-bord' : '/onboarding');
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.04] p-6 text-white shadow-raised backdrop-blur-sm">
      <TransitionEtape etape={step} sens={sens}>
      {step === 'email' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <h1 className="font-display text-2xl font-bold tracking-tight">Connexion</h1>
          <p className="mt-2 text-sm text-white/70">
            Entrez votre adresse email : nous vous envoyons un code à {CODE_LENGTH} chiffres.
          </p>

          <label htmlFor="email" className="mt-6 block text-xs font-medium text-white/60">
            Adresse email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="vous@exemple.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-md border border-white/15 bg-white/5 px-3 text-base outline-none placeholder:text-white/30 focus:border-gold"
          />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" size="lg" block className="mt-5" loading={pending} disabled={!isValidEmail(email)}>
            Recevoir mon code
            <ArrowRight aria-hidden />
          </Button>
          <p className="mt-4 text-xs text-white/50">
            En continuant, vous acceptez nos conditions d’utilisation. Votre adresse sert à sécuriser votre compte et
            à vous informer de l’avancement de vos commandes.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSens('arriere');
              setStep('email');
              setError(null);
              setCode('');
            }}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Changer d’adresse
          </button>

          <h1 className="font-display text-2xl font-bold tracking-tight">Votre code</h1>
          <p className="mt-2 text-sm break-words text-white/70">
            <Mail className="mr-1.5 inline size-4 text-gold" aria-hidden />
            Envoyé à <span className="font-semibold text-white">{email.trim().toLowerCase()}</span>
          </p>

          <label htmlFor="code" className="mt-6 block text-xs font-medium text-white/60">
            Code à {CODE_LENGTH} chiffres
          </label>
          <input
            id="code"
            ref={codeInput}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) => setCode(event.target.value.replaceAll(/\D/g, ''))}
            className="figures mt-1.5 h-14 w-full rounded-md border border-white/15 bg-white/5 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-gold"
          />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" size="lg" block className="mt-5" loading={pending} disabled={code.length < CODE_LENGTH}>
            Me connecter
            <ArrowRight aria-hidden />
          </Button>

          <button
            type="button"
            disabled={secondsLeft > 0 || pending}
            onClick={() => void sendCode()}
            className="mt-4 w-full text-center text-xs font-semibold text-gold disabled:text-white/40"
          >
            {secondsLeft > 0 ? `Renvoyer le code dans ${secondsLeft} s` : 'Renvoyer le code'}
          </button>
          <p className="mt-3 text-center text-xs text-white/40">
            Rien reçu ? Pensez à regarder dans les courriers indésirables.
          </p>
        </form>
      )}
      </TransitionEtape>
    </Card>
  );
}

function ErrorMessage({ children }: { children: string }) {
  return (
    <p role="alert" className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      {children}
    </p>
  );
}

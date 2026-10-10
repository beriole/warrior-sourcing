'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n/request';

/**
 * Choix de la langue.
 *
 * Le cookie est posé côté serveur plutôt que depuis le navigateur : c'est le rendu
 * serveur qui le lit pour choisir les messages, et le poser ici évite un premier rendu
 * dans l'ancienne langue. Une valeur inconnue retombe sur le français plutôt que de
 * laisser l'application sans messages.
 */
export async function definirLangue(code: string): Promise<void> {
  const locale: Locale = (LOCALES as readonly string[]).includes(code) ? (code as Locale) : DEFAULT_LOCALE;

  (await cookies()).set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}

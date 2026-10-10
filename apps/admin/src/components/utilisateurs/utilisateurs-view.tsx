'use client';

import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type AdminUserListResponse,
  type AdminUserResponse,
  type MeResponse,
  type UpdateUserRoleResponse,
  type UserRole,
} from '@ws/contracts';
import { Badge, Button, Card } from '@ws/ui';
import { Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, etatDepuisErreur, type EtatAcces } from '@/components/admin/api';
import { EcranAcces, EnTete, EtatVide, MessageErreur, MessageInfo, SqueletteListe } from '@/components/admin/etats';

/** Les rôles de l'équipe interne sont mis en avant : ce sont eux qui donnent des droits. */
function tonRole(role: UserRole) {
  if (role === 'SUPER_ADMIN') return 'danger' as const;
  if (role === 'ADMIN') return 'brand' as const;
  if (role === 'CLIENT') return 'neutral' as const;
  return 'night' as const;
}

/**
 * Comptes et rôles (ADM-07, §40).
 *
 * Le changement de rôle n'est proposé qu'au SUPER_ADMIN, et le serveur le refuse de toute
 * façon aux autres : l'interface masque, le serveur refuse. Chaque changement est journalisé.
 */
export function UtilisateursView() {
  const [liste, setListe] = useState<AdminUserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [moi, setMoi] = useState<MeResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState<UserRole | ''>('');
  const [criteres, setCriteres] = useState({ recherche: '', role: '' as UserRole | '' });
  const [version, setVersion] = useState(0);

  const [cible, setCible] = useState<AdminUserResponse | null>(null);
  const [nouveauRole, setNouveauRole] = useState<UserRole>('CLIENT');
  const [motif, setMotif] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    appelApi<MeResponse>('/me')
      .then(setMoi)
      .catch(() => setMoi(null));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.role) params.set('role', criteres.role);
    appelApi<AdminUserListResponse>(`/admin/users?${params.toString()}`)
      .then((data) => {
        setListe(data.users);
        setTotal(data.total);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);

  const estSuperAdmin = moi?.user.role === 'SUPER_ADMIN';

  function ouvrirChangement(utilisateur: AdminUserResponse) {
    setCible(utilisateur);
    setNouveauRole(utilisateur.role);
    setMotif('');
    setErreur(null);
    setInfo(null);
  }

  async function enregistrerRole() {
    if (!cible) return;
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const reponse = await appelApi<UpdateUserRoleResponse>(`/admin/users/${cible.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nouveauRole, reason: motif.trim() }),
      });
      setInfo(
        `${reponse.user.name} est passé de « ${USER_ROLE_LABELS[reponse.previousRole]} » à « ${USER_ROLE_LABELS[reponse.user.role]} ». Le changement est journalisé.`,
      );
      setCible(null);
      recharger();
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les comptes" onReessayer={recharger} />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <EnTete
        titre="Utilisateurs et rôles"
        sousTitre="Les droits sont vérifiés par le serveur à chaque requête (§40)."
      />

      {!estSuperAdmin ? (
        <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
          Seul un super-administrateur peut modifier un rôle. Vous pouvez consulter la liste.
        </p>
      ) : null}

      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setCriteres({ recherche: recherche.trim(), role: filtreRole });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Rechercher</span>
          <input
            className="h-11 w-60 rounded-md border border-border px-3"
            placeholder="Nom, email ou téléphone"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Rôle</span>
          <select
            className="h-11 w-56 rounded-md border border-border px-3"
            value={filtreRole}
            onChange={(event) => setFiltreRole(event.target.value as UserRole | '')}
          >
            <option value="">Tous les rôles</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Filtrer
        </Button>
      </form>

      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
      {info ? <MessageInfo>{info}</MessageInfo> : null}

      {cible ? (
        <Card className="mt-4">
          <h2 className="text-base font-bold">
            Changer le rôle de {cible.name} ({cible.email})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rôle actuel : {USER_ROLE_LABELS[cible.role]}. Le motif est conservé dans le journal d’audit.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Nouveau rôle</span>
              <select
                className="h-11 w-56 rounded-md border border-border px-3"
                value={nouveauRole}
                onChange={(event) => setNouveauRole(event.target.value as UserRole)}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-semibold">Motif</span>
              <input
                className="h-11 min-w-60 rounded-md border border-border px-3"
                placeholder="Pourquoi ce changement ?"
                value={motif}
                onChange={(event) => setMotif(event.target.value)}
              />
            </label>
            <Button onClick={() => void enregistrerRole()} loading={enregistrement} disabled={enregistrement}>
              <ShieldCheck aria-hidden />
              Enregistrer
            </Button>
            <Button variant="ghost" onClick={() => setCible(null)}>
              Annuler
            </Button>
          </div>
        </Card>
      ) : null}

      {chargement ? (
        <SqueletteListe />
      ) : liste.length === 0 ? (
        <EtatVide
          titre="Aucun compte ne correspond"
          explication="Modifiez la recherche ou le filtre de rôle pour élargir la liste."
        />
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">{total} compte(s) au total.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Compte</th>
                  <th className="py-2 pr-3 font-semibold">Rôle</th>
                  <th className="py-2 pr-3 text-right font-semibold">Commandes</th>
                  <th className="py-2 pr-3 font-semibold">Inscrit le</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {liste.map((utilisateur) => (
                  <tr key={utilisateur.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{utilisateur.name || 'Sans nom'}</span>
                      <span className="block text-xs text-muted-foreground">{utilisateur.email}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={tonRole(utilisateur.role)}>{USER_ROLE_LABELS[utilisateur.role]}</Badge>
                    </td>
                    <td className="figures py-2 pr-3 text-right">{utilisateur.orderCount}</td>
                    <td className="py-2 pr-3">{dateCourte(utilisateur.createdAt)}</td>
                    <td className="py-2 text-right">
                      {estSuperAdmin ? (
                        <Button size="sm" variant="outline" onClick={() => ouvrirChangement(utilisateur)}>
                          Changer le rôle
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

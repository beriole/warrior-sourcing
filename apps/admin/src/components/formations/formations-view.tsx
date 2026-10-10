'use client';

import {
  COURSE_ACCESSES,
  COURSE_ACCESS_LABELS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  COURSE_THEMES,
  COURSE_THEME_LABELS,
  formatDuration,
  type AdminCourseDetailResponse,
  type AdminCourseListResponse,
  type AdminCourseResponse,
  type AdminInstructorListResponse,
  type AdminResourceListResponse,
  type CourseAccess,
  type CourseLevel,
  type CourseTheme,
} from '@ws/contracts';
import { Badge, Button, Card, Money } from '@ws/ui';
import { AlertTriangle, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { appelApi, dateCourte, etatDepuisErreur, xaf, type EtatAcces } from '@/components/admin/api';
import { Champ, ChampChoix, ChampNombre, ChampTexte, Section } from '@/components/admin/champs';
import {
  EcranAcces,
  EnTete,
  EtatVide,
  MessageErreur,
  MessageInfo,
  SqueletteListe,
} from '@/components/admin/etats';

const FORM_VIDE = {
  title: '',
  summary: '',
  description: '',
  level: 'BEGINNER' as CourseLevel,
  theme: 'BASICS' as CourseTheme,
  access: 'FREE' as CourseAccess,
  priceXaf: 0,
  outcomes: '',
  prerequisites: '',
  instructorId: '',
};

const FORMATEUR_VIDE = { name: '', headline: '', bio: '' };

/** Une liste saisie une ligne à la fois : plus simple à relire qu'un champ à virgules. */
function enLignes(texte: string): string[] {
  return texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean);
}

/**
 * Gestion des formations et de la bibliothèque (ADM-05, §26).
 *
 * Le programme se construit ici : chapitres, leçons, vidéos, extraits offerts. Comme pour
 * les produits, c'est le serveur qui dit si une formation est publiable, et l'écran se
 * contente d'afficher sa liste. Un bouton « Publier » grisé avec la raison juste au-dessus
 * vaut mieux qu'un bouton actif qui renvoie une erreur.
 */
export function FormationsView() {
  const [liste, setListe] = useState<AdminCourseResponse[]>([]);
  const [publiees, setPubliees] = useState(0);
  const [brouillons, setBrouillons] = useState(0);
  const [formateurs, setFormateurs] = useState<AdminInstructorListResponse['items']>([]);
  // Tant que la liste n'est pas revenue, « aucun formateur » serait un mensonge :
  // on ne peut pas distinguer une liste vide d'une requête en cours.
  const [formateursCharges, setFormateursCharges] = useState(false);
  const [ressources, setRessources] = useState<AdminResourceListResponse['items']>([]);
  const [chargement, setChargement] = useState(true);
  const [acces, setAcces] = useState<EtatAcces>('ok');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtrePubliee, setFiltrePubliee] = useState<'oui' | 'non' | ''>('');
  const [criteres, setCriteres] = useState({ recherche: '', publiee: '' as 'oui' | 'non' | '' });
  const [version, setVersion] = useState(0);

  const [detail, setDetail] = useState<AdminCourseDetailResponse | null>(null);
  const [creation, setCreation] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [formateur, setFormateur] = useState(FORMATEUR_VIDE);
  const [nouveauChapitre, setNouveauChapitre] = useState('');
  const [nouvelleLecon, setNouvelleLecon] = useState<{ chapitreId: string; titre: string; duree: number }>({
    chapitreId: '',
    titre: '',
    duree: 0,
  });
  const [motif, setMotif] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  /** Leçon dont on a ouvert le détail : vidéo et documents. Une seule à la fois. */
  const [leconOuverte, setLeconOuverte] = useState<string | null>(null);
  const [video, setVideo] = useState({ publicId: '', format: 'mp4' });
  const [nouveauDocument, setNouveauDocument] = useState({ title: '', url: '', fileFormat: 'pdf' });

  const traiterErreur = useCallback((e: unknown) => {
    const etat = etatDepuisErreur(e);
    if (etat) setAcces(etat);
    else setErreur(e instanceof Error ? e.message : 'Une erreur inattendue s’est produite.');
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (criteres.recherche) params.set('recherche', criteres.recherche);
    if (criteres.publiee) params.set('publiee', criteres.publiee);
    appelApi<AdminCourseListResponse>(`/admin/courses?${params.toString()}`)
      .then((data) => {
        setListe(data.items);
        setPubliees(data.publishedCount);
        setBrouillons(data.draftCount);
        setAcces('ok');
      })
      .catch(traiterErreur)
      .finally(() => setChargement(false));
  }, [criteres, version, traiterErreur]);

  useEffect(() => {
    appelApi<AdminInstructorListResponse>('/admin/instructors')
      .then((data) => {
        setFormateurs(data.items);
        setFormateursCharges(true);
      })
      .catch(traiterErreur);
    appelApi<AdminResourceListResponse>('/admin/resources')
      .then((data) => setRessources(data.items))
      .catch(traiterErreur);
  }, [version, traiterErreur]);

  function rafraichir() {
    setChargement(true);
    setVersion((v) => v + 1);
  }

  /** Toutes les écritures du programme renvoient la fiche complète : un seul chemin de mise à jour. */
  async function agir(
    chemin: string,
    init: RequestInit,
    message: string,
  ): Promise<AdminCourseDetailResponse | null> {
    setErreur(null);
    setInfo(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminCourseDetailResponse>(chemin, init);
      setDetail(data);
      setInfo(message);
      return data;
    } catch (e) {
      traiterErreur(e);
      return null;
    } finally {
      setEnregistrement(false);
    }
  }

  async function ouvrir(id: string) {
    setErreur(null);
    setInfo(null);
    setCreation(false);
    setMotif('');
    try {
      setDetail(await appelApi<AdminCourseDetailResponse>(`/admin/courses/${id}`));
    } catch (e) {
      traiterErreur(e);
    }
  }

  async function creer() {
    const data = await agir(
      '/admin/courses',
      {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          description: form.description,
          level: form.level,
          theme: form.theme,
          access: form.access,
          priceXaf: form.access === 'PAID' ? form.priceXaf : 0,
          outcomes: enLignes(form.outcomes),
          prerequisites: enLignes(form.prerequisites),
          instructorId: form.instructorId,
        }),
      },
      'Formation créée. Construisez son programme, puis publiez-la.',
    );
    if (data) {
      setCreation(false);
      setForm(FORM_VIDE);
      rafraichir();
    }
  }

  async function ajouterFormateur() {
    setErreur(null);
    setEnregistrement(true);
    try {
      const data = await appelApi<AdminInstructorListResponse>('/admin/instructors', {
        method: 'POST',
        body: JSON.stringify({
          name: formateur.name,
          headline: formateur.headline,
          bio: formateur.bio || null,
        }),
      });
      setFormateurs(data.items);
      setFormateur(FORMATEUR_VIDE);
      setInfo('Formateur ajouté.');
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnregistrement(false);
    }
  }

  if (acces !== 'ok') {
    return <EcranAcces etat={acces} sujet="gérer les formations" onReessayer={rafraichir} />;
  }

  const manques = detail?.course.missingForPublication ?? [];
  const sansFichier = ressources.filter((ressource) => !ressource.hasFile).length;

  return (
    <div className="grid gap-5">
      <EnTete
        titre="Formations"
        sousTitre="Une formation se construit chapitre par chapitre, puis se publie. Le serveur refuse de publier un programme vide."
        actions={
          <Button
            onClick={() => {
              setCreation(true);
              setDetail(null);
              setForm({ ...FORM_VIDE, instructorId: formateurs[0]?.id ?? '' });
            }}
            disabled={formateurs.length === 0}
          >
            <Plus aria-hidden />
            Nouvelle formation
          </Button>
        }
      />

      {formateursCharges && formateurs.length === 0 && (
        <p className="inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Aucun formateur enregistré : une formation doit être animée par quelqu’un. Ajoutez-en un ci-dessous.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-xs font-medium text-muted-foreground sm:max-w-sm">
          Rechercher
          <input
            value={recherche}
            placeholder="Titre de la formation"
            onChange={(event) => setRecherche(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setCriteres({ recherche, publiee: filtrePubliee });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
          />
        </label>
        <ChampChoix
          label="Publication"
          value={filtrePubliee}
          onChange={setFiltrePubliee}
          vide="Toutes"
          options={[
            { value: 'oui' as const, label: 'Publiées' },
            { value: 'non' as const, label: 'Brouillons' },
          ]}
        />
        <Button variant="outline" onClick={() => setCriteres({ recherche, publiee: filtrePubliee })}>
          <Search aria-hidden />
          Filtrer
        </Button>
      </div>

      <p className="figures text-xs text-muted-foreground">
        {publiees} publiée{publiees > 1 ? 's' : ''}, {brouillons} brouillon{brouillons > 1 ? 's' : ''} ·{' '}
        {ressources.length} ressource{ressources.length > 1 ? 's' : ''} en bibliothèque
        {sansFichier > 0 && `, dont ${sansFichier} sans fichier déposé`}
      </p>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      {info && <MessageInfo>{info}</MessageInfo>}

      {chargement ? (
        <SqueletteListe />
      ) : liste.length === 0 ? (
        <EtatVide
          titre="Aucune formation ne correspond"
          explication="Modifiez la recherche, ou créez une nouvelle formation."
        />
      ) : (
        <ul className="grid gap-2">
          {liste.map((formation) => (
            <li key={formation.id}>
              <button
                type="button"
                onClick={() => void ouvrir(formation.id)}
                aria-current={detail?.course.id === formation.id ? 'true' : undefined}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  detail?.course.id === formation.id
                    ? 'border-primary bg-surface-muted'
                    : 'border-border bg-surface hover:bg-surface-muted'
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{formation.title}</span>
                  <Badge tone={formation.published ? 'success' : 'warning'}>
                    {formation.published ? 'Publiée' : 'Brouillon'}
                  </Badge>
                  <Badge tone="neutral">{formation.levelLabel}</Badge>
                  <Badge tone="neutral">{formation.themeLabel}</Badge>
                  {formation.access === 'PAID' && (
                    <Badge tone="brand">
                      <Money value={xaf(formation.priceXaf)} />
                    </Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formation.publishedLessonCount} leçon
                  {formation.publishedLessonCount > 1 ? 's' : ''} publiée
                  {formation.publishedLessonCount > 1 ? 's' : ''} sur {formation.lessonCount} ·{' '}
                  {formatDuration(formation.durationMinutes)} · {formation.enrollmentCount} inscrit
                  {formation.enrollmentCount > 1 ? 's' : ''} · animée par {formation.instructorName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creation && (
        <Card className="grid gap-4">
          <Section
            titre="Nouvelle formation"
            description="Elle est créée non publiée : rien n’apparaît à l’Academy avant que son programme ne tienne."
          >
            <Champ label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} requis />
            <Champ
              label="Résumé"
              value={form.summary}
              onChange={(v) => setForm({ ...form, summary: v })}
              aide="Une phrase : ce que la formation apprend concrètement."
              requis
            />
            <ChampTexte
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChampChoix
                label="Niveau"
                value={form.level}
                onChange={(v) => v && setForm({ ...form, level: v })}
                options={COURSE_LEVELS.map((niveau) => ({
                  value: niveau,
                  label: COURSE_LEVEL_LABELS[niveau].label,
                }))}
                aide={COURSE_LEVEL_LABELS[form.level].description}
              />
              <ChampChoix
                label="Thème"
                value={form.theme}
                onChange={(v) => v && setForm({ ...form, theme: v })}
                options={COURSE_THEMES.map((theme) => ({ value: theme, label: COURSE_THEME_LABELS[theme] }))}
              />
              <ChampChoix
                label="Accès"
                value={form.access}
                onChange={(v) => v && setForm({ ...form, access: v, priceXaf: v === 'PAID' ? form.priceXaf : 0 })}
                options={COURSE_ACCESSES.map((acces) => ({
                  value: acces,
                  label: COURSE_ACCESS_LABELS[acces],
                }))}
              />
              <ChampNombre
                label="Prix (FCFA)"
                value={form.priceXaf}
                onChange={(v) => setForm({ ...form, priceXaf: v })}
                aide={form.access === 'PAID' ? 'Obligatoire pour une formation payante.' : 'Sans objet ici.'}
              />
            </div>
            <ChampChoix
              label="Formateur"
              value={form.instructorId}
              onChange={(v) => setForm({ ...form, instructorId: v })}
              options={formateurs.map((item) => ({ value: item.id, label: `${item.name} — ${item.headline}` }))}
              vide="Choisir un formateur"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ChampTexte
                label="Ce que vous saurez faire"
                value={form.outcomes}
                onChange={(v) => setForm({ ...form, outcomes: v })}
                aide="Un objectif par ligne. Aucune promesse de gain (§54). Obligatoire pour publier."
              />
              <ChampTexte
                label="Avant de commencer"
                value={form.prerequisites}
                onChange={(v) => setForm({ ...form, prerequisites: v })}
                aide="Un prérequis par ligne."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void creer()} loading={enregistrement} disabled={!form.instructorId}>
                Créer la formation
              </Button>
              <Button variant="outline" onClick={() => setCreation(false)}>
                Annuler
              </Button>
            </div>
          </Section>
        </Card>
      )}

      {detail && (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{detail.course.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.course.levelLabel} · {detail.course.themeLabel} · {detail.course.accessLabel} ·{' '}
                animée par {detail.course.instructorName}
                {detail.course.publishedAt && ` · publiée le ${dateCourte(detail.course.publishedAt)}`}
              </p>
            </div>
            <Badge tone={detail.course.published ? 'success' : 'warning'}>
              {detail.course.published ? 'Publiée' : 'Brouillon'}
            </Badge>
          </div>

          {manques.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                Il manque ceci pour publier
              </p>
              <ul className="mt-1.5 list-inside list-disc text-muted-foreground">
                {manques.map((manque) => (
                  <li key={manque}>{manque}</li>
                ))}
              </ul>
            </div>
          )}

          <Section titre="Programme" description="Les leçons non publiées ne comptent ni dans la durée ni au catalogue.">
            {detail.chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun chapitre pour l’instant.</p>
            ) : (
              <ul className="grid gap-3">
                {detail.chapters.map((chapitre, rangChapitre) => (
                  <li key={chapitre.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {/* Le rang affiché vient de l'ordre reçu, pas du champ `position` :
                            les contenus les plus anciens sont numérotés à partir de zéro. */}
                        <span className="text-muted-foreground">Chapitre {rangChapitre + 1} — </span>
                        {chapitre.title}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={enregistrement}
                        onClick={() =>
                          void agir(
                            `/admin/courses/${detail.course.id}/chapters/${chapitre.id}`,
                            { method: 'DELETE' },
                            'Chapitre supprimé.',
                          )
                        }
                      >
                        <Trash2 aria-hidden />
                        Supprimer
                      </Button>
                    </div>

                    <ul className="mt-2 grid gap-1.5">
                      {chapitre.lessons.map((lecon, rangLecon) => (
                        <li
                          key={lecon.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm"
                        >
                          <span>
                            {rangLecon + 1}. {lecon.title}
                            <span className="figures ml-2 text-xs text-muted-foreground">
                              {lecon.durationMinutes > 0 ? `${lecon.durationMinutes} min` : 'durée non renseignée'}
                              {!lecon.hasVideo && ' · sans vidéo'}
                            </span>
                            {lecon.preview && (
                              <Badge tone="success" className="ml-2">
                                Extrait offert
                              </Badge>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone={lecon.published ? 'success' : 'neutral'}>
                              {lecon.published ? 'Publiée' : 'Brouillon'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const ouvrir = leconOuverte !== lecon.id;
                                setLeconOuverte(ouvrir ? lecon.id : null);
                                // Le formulaire repart propre à chaque ouverture : laisser la
                                // saisie d'une autre leçon ferait attacher le fichier au mauvais
                                // endroit sans que rien ne le signale.
                                setVideo({ publicId: '', format: 'mp4' });
                                setNouveauDocument({ title: '', url: '', fileFormat: 'pdf' });
                              }}
                            >
                              {leconOuverte === lecon.id ? 'Fermer' : 'Contenus'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              loading={enregistrement}
                              onClick={() =>
                                void agir(
                                  `/admin/courses/${detail.course.id}/lessons/${lecon.id}`,
                                  { method: 'PATCH', body: JSON.stringify({ published: !lecon.published }) },
                                  lecon.published ? 'Leçon retirée.' : 'Leçon publiée.',
                                )
                              }
                            >
                              {lecon.published ? 'Retirer' : 'Publier'}
                            </Button>
                          </span>

                          {leconOuverte === lecon.id && (
                            <div className="mt-2 grid w-full gap-4 rounded-md border border-border bg-surface p-3">
                              {/* ── Vidéo ── */}
                              <div className="grid gap-2">
                                <p className="text-xs font-semibold text-foreground">
                                  Vidéo{' '}
                                  <span className="font-normal text-muted-foreground">
                                    {lecon.hasVideo ? '— déposée' : '— aucune'}
                                  </span>
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Identifiant Cloudinary du fichier, et son extension. L’URL de lecture
                                  n’est jamais stockée : elle est signée à la demande, après vérification
                                  du droit d’accès.
                                </p>
                                <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                                  <input
                                    value={video.publicId}
                                    placeholder="academy/bases-import/lecon-1"
                                    onChange={(event) => setVideo({ ...video, publicId: event.target.value })}
                                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
                                  />
                                  <input
                                    value={video.format}
                                    placeholder="mp4"
                                    onChange={(event) => setVideo({ ...video, format: event.target.value })}
                                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    loading={enregistrement}
                                    disabled={!video.publicId.trim() || video.format.trim().length < 2}
                                    onClick={() =>
                                      void agir(
                                        `/admin/courses/${detail.course.id}/lessons/${lecon.id}`,
                                        {
                                          method: 'PATCH',
                                          body: JSON.stringify({
                                            videoPublicId: video.publicId.trim(),
                                            videoFormat: video.format.trim(),
                                          }),
                                        },
                                        'Vidéo attachée.',
                                      )
                                    }
                                  >
                                    Attacher la vidéo
                                  </Button>
                                  {lecon.hasVideo && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      loading={enregistrement}
                                      onClick={() =>
                                        void agir(
                                          `/admin/courses/${detail.course.id}/lessons/${lecon.id}`,
                                          {
                                            method: 'PATCH',
                                            body: JSON.stringify({ videoPublicId: null, videoFormat: null }),
                                          },
                                          'Vidéo retirée.',
                                        )
                                      }
                                    >
                                      Retirer la vidéo
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* ── Documents ── */}
                              <div className="grid gap-2 border-t border-border pt-3">
                                <p className="text-xs font-semibold text-foreground">
                                  Documents{' '}
                                  <span className="font-normal text-muted-foreground">
                                    — {lecon.documentCount} attaché{lecon.documentCount > 1 ? 's' : ''}
                                  </span>
                                </p>

                                {lecon.documents.length > 0 && (
                                  <ul className="grid gap-1.5">
                                    {lecon.documents.map((doc) => (
                                      <li
                                        key={doc.id}
                                        className="flex items-center justify-between gap-2 rounded bg-surface-muted px-2 py-1.5 text-xs"
                                      >
                                        <span className="min-w-0 truncate">
                                          {doc.title}{' '}
                                          <span className="uppercase text-muted-foreground">
                                            {doc.fileFormat}
                                          </span>
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          loading={enregistrement}
                                          aria-label={`Retirer ${doc.title}`}
                                          onClick={() =>
                                            void agir(
                                              `/admin/courses/${detail.course.id}/lessons/${lecon.id}/documents/${doc.id}`,
                                              { method: 'DELETE' },
                                              'Document retiré.',
                                            )
                                          }
                                        >
                                          <Trash2 className="size-3.5" aria-hidden />
                                        </Button>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                <div className="grid gap-2 sm:grid-cols-[2fr_3fr_1fr]">
                                  <input
                                    value={nouveauDocument.title}
                                    placeholder="Checklist de négociation"
                                    onChange={(event) => setNouveauDocument({ ...nouveauDocument, title: event.target.value })}
                                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
                                  />
                                  <input
                                    value={nouveauDocument.url}
                                    type="url"
                                    placeholder="https://..."
                                    onChange={(event) => setNouveauDocument({ ...nouveauDocument, url: event.target.value })}
                                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
                                  />
                                  <input
                                    value={nouveauDocument.fileFormat}
                                    placeholder="pdf"
                                    onChange={(event) =>
                                      setNouveauDocument({ ...nouveauDocument, fileFormat: event.target.value })
                                    }
                                    className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary"
                                  />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Le format est demandé à part : beaucoup d’hébergeurs servent un fichier
                                  sous une adresse qui n’en porte aucune.
                                </p>
                                <div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    loading={enregistrement}
                                    disabled={nouveauDocument.title.trim().length < 2 || !nouveauDocument.url.trim()}
                                    onClick={() =>
                                      void agir(
                                        `/admin/courses/${detail.course.id}/lessons/${lecon.id}/documents`,
                                        {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            title: nouveauDocument.title.trim(),
                                            url: nouveauDocument.url.trim(),
                                            fileFormat: nouveauDocument.fileFormat.trim(),
                                          }),
                                        },
                                        'Document attaché.',
                                      )
                                    }
                                  >
                                    Attacher le document
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Champ
                        label="Nouvelle leçon"
                        value={nouvelleLecon.chapitreId === chapitre.id ? nouvelleLecon.titre : ''}
                        onChange={(v) => setNouvelleLecon({ chapitreId: chapitre.id, titre: v, duree: nouvelleLecon.duree })}
                        placeholder="Titre de la leçon"
                      />
                      <ChampNombre
                        label="Durée (min)"
                        value={nouvelleLecon.chapitreId === chapitre.id ? nouvelleLecon.duree : 0}
                        onChange={(v) =>
                          setNouvelleLecon({ chapitreId: chapitre.id, titre: nouvelleLecon.titre, duree: v })
                        }
                      />
                      <Button
                        variant="outline"
                        loading={enregistrement}
                        disabled={nouvelleLecon.chapitreId !== chapitre.id || nouvelleLecon.titre.trim().length < 3}
                        onClick={async () => {
                          const ok = await agir(
                            `/admin/courses/${detail.course.id}/chapters/${chapitre.id}/lessons`,
                            {
                              method: 'POST',
                              body: JSON.stringify({
                                title: nouvelleLecon.titre,
                                durationMinutes: nouvelleLecon.duree,
                              }),
                            },
                            'Leçon ajoutée.',
                          );
                          if (ok) setNouvelleLecon({ chapitreId: '', titre: '', duree: 0 });
                        }}
                      >
                        <Plus aria-hidden />
                        Ajouter
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <Champ label="Nouveau chapitre" value={nouveauChapitre} onChange={setNouveauChapitre} />
              <Button
                variant="outline"
                loading={enregistrement}
                disabled={nouveauChapitre.trim().length < 3}
                onClick={async () => {
                  const ok = await agir(
                    `/admin/courses/${detail.course.id}/chapters`,
                    { method: 'POST', body: JSON.stringify({ title: nouveauChapitre }) },
                    'Chapitre ajouté.',
                  );
                  if (ok) setNouveauChapitre('');
                }}
              >
                <Plus aria-hidden />
                Ajouter le chapitre
              </Button>
            </div>
          </Section>

          <Section
            titre="Publication"
            description="Le motif est obligatoire : il est conservé au journal d’audit avec votre nom."
          >
            <Champ label="Motif de la décision" value={motif} onChange={setMotif} />
            <div className="flex flex-wrap gap-2">
              <Button
                loading={enregistrement}
                disabled={manques.length > 0 || motif.trim().length < 5 || detail.course.published}
                onClick={() =>
                  void agir(
                    `/admin/courses/${detail.course.id}/publication`,
                    { method: 'PATCH', body: JSON.stringify({ published: true, reason: motif }) },
                    'Formation publiée. Elle apparaît à l’Academy.',
                  ).then(rafraichir)
                }
              >
                Publier
              </Button>
              <Button
                variant="outline"
                loading={enregistrement}
                disabled={motif.trim().length < 5 || !detail.course.published}
                onClick={() =>
                  void agir(
                    `/admin/courses/${detail.course.id}/publication`,
                    { method: 'PATCH', body: JSON.stringify({ published: false, reason: motif }) },
                    'Formation retirée de l’Academy. Les inscriptions et la progression sont conservées.',
                  ).then(rafraichir)
                }
              >
                Retirer de l’Academy
              </Button>
            </div>
          </Section>
        </Card>
      )}

      <Card className="grid gap-3">
        <Section titre="Formateurs" description="Une ligne qui dit ce que la personne fait réellement, pas un titre.">
          <ul className="grid gap-1.5 text-sm">
            {formateurs.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.headline} · {item.courseCount} formation{item.courseCount > 1 ? 's' : ''}
                </span>
              </li>
            ))}
            {formateursCharges && formateurs.length === 0 && (
              <li className="text-muted-foreground">Aucun formateur enregistré.</li>
            )}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Nom" value={formateur.name} onChange={(v) => setFormateur({ ...formateur, name: v })} />
            <Champ
              label="Ce qu’il ou elle fait"
              value={formateur.headline}
              onChange={(v) => setFormateur({ ...formateur, headline: v })}
              placeholder="Transitaire au port de Douala depuis huit ans"
            />
          </div>
          <div>
            <Button
              variant="outline"
              loading={enregistrement}
              disabled={formateur.name.trim().length < 2 || formateur.headline.trim().length < 5}
              onClick={() => void ajouterFormateur()}
            >
              <UserPlus aria-hidden />
              Ajouter le formateur
            </Button>
          </div>
        </Section>
      </Card>
    </div>
  );
}

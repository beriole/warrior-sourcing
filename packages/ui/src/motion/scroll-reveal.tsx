/**
 * Révélation au défilement — le script, pas le style.
 *
 * Il se place en tout premier dans <body> et s'exécute pendant l'analyse du
 * document, donc avant la première image : la marque `data-ws-js` est posée sur
 * <html> avant qu'un seul élément `.ws-onview` ne soit analysé, et personne ne
 * voit le contenu apparaître puis disparaître.
 *
 * C'est un **attribut** et non une classe. React possède `className` sur <html> :
 * le modifier avant l'hydratation produisait une divergence entre le rendu serveur
 * et le rendu client, signalée sur chaque page et jamais réparée. Un attribut que
 * React n'a pas rendu le laisse indifférent.
 *
 * Le repli est l'inverse de l'habituel : tant que ce script n'a pas tourné,
 * rien n'est caché. Script bloqué, navigateur ancien, mouvement réduit, erreur
 * à l'exécution — dans tous ces cas la page reste entièrement lisible. C'est la
 * seule répartition acceptable quand le public est sur un Android d'entrée de
 * gamme avec une connexion incertaine.
 *
 * La marque posée est un attribut, jamais une classe : React possède
 * `className` et peut le réécrire à l'hydratation, ce qui rendrait la section
 * de nouveau invisible.
 */
export function ScriptRevelation() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

const SCRIPT = `(function(){var r=document.documentElement;try{
if(!window.IntersectionObserver||!window.MutationObserver)return;
if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
r.setAttribute('data-ws-js','');
var suivis=new WeakSet();
var io=new IntersectionObserver(function(entrees){for(var i=0;i<entrees.length;i++){var e=entrees[i];
/* Déjà dépassé vers le haut (ancre, position restaurée) : on révèle sans attendre. */
if(e.isIntersecting||e.boundingClientRect.bottom<0){e.target.setAttribute('data-ws-vu','');io.unobserve(e.target);}}},
{rootMargin:'0px 0px -8% 0px'});
var prevu=0;
function scanner(){prevu=0;var els=document.querySelectorAll('.ws-onview:not([data-ws-vu])');
for(var i=0;i<els.length;i++){if(!suivis.has(els[i])){suivis.add(els[i]);io.observe(els[i]);}}}
function replanifier(){if(!prevu)prevu=requestAnimationFrame(scanner);}
/* Le corps du document n'est pas encore analysé : c'est l'observateur de mutations
   qui attrape les sections au fur et à mesure, puis à chaque navigation. */
new MutationObserver(replanifier).observe(r,{childList:true,subtree:true});
replanifier();
}catch(err){r.removeAttribute('data-ws-js');}})();`;

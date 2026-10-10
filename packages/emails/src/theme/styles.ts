import { color, layout } from './tokens.js';

/**
 * Feuille de style injectée dans le <head>.
 *
 * Règles de survie en environnement email :
 * - tout ce qui compte est déjà porté par les styles inline ; ce fichier n'ajoute que du confort ;
 * - une animation part toujours de l'état final visible, donc un client qui supprime
 *   les @keyframes (Gmail, Outlook) affiche un email complet et immobile ;
 * - le responsive passe par des classes `sm-*` appliquées sous 620 px.
 */
export const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  img { border: 0; outline: none; line-height: 100%; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .figures { font-variant-numeric: tabular-nums lining-nums; }

  /* ── Mouvement (ignoré par les clients qui filtrent les @keyframes) ── */
  @keyframes ws-rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ws-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200, 16, 46, 0.55); }
    50% { box-shadow: 0 0 0 9px rgba(200, 16, 46, 0); }
  }
  @keyframes ws-sweep {
    from { background-position: 0% 50%; }
    to { background-position: 200% 50%; }
  }
  @keyframes ws-glow {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }

  .ws-rise { animation: ws-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .ws-rise-2 { animation: ws-rise 0.7s 0.12s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .ws-rise-3 { animation: ws-rise 0.7s 0.24s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .ws-pulse { animation: ws-pulse 2.2s ease-out infinite; }
  .ws-glow { animation: ws-glow 3s ease-in-out infinite; }
  /* Lumière qui parcourt le filet doré : le fond reste plein si l'animation est filtrée. */
  .ws-sweep {
    background-image: linear-gradient(90deg, ${color.gold} 0%, ${color.goldBright} 25%, ${color.imperial} 50%, ${color.goldBright} 75%, ${color.gold} 100%);
    background-size: 200% 100%;
    animation: ws-sweep 4s linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .ws-rise, .ws-rise-2, .ws-rise-3, .ws-pulse, .ws-glow, .ws-sweep {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }

  /* ── Mobile : sous 620 px ── */
  @media only screen and (max-width: 620px) {
    .sm-full { width: 100% !important; max-width: 100% !important; }
    .sm-stack { display: block !important; width: 100% !important; max-width: 100% !important; }
    .sm-stack-gap { padding-bottom: 12px !important; }
    .sm-pad { padding-left: ${layout.gutterMobile} !important; padding-right: ${layout.gutterMobile} !important; }
    .sm-pad-y { padding-top: 22px !important; padding-bottom: 22px !important; }
    .sm-center { text-align: center !important; }
    .sm-left { text-align: left !important; }
    .sm-title { font-size: 23px !important; line-height: 29px !important; }
    .sm-amount { font-size: 28px !important; line-height: 34px !important; }
    .sm-hide { display: none !important; }
    .sm-btn { display: block !important; width: 100% !important; text-align: center !important; }
  }

  /* ── Mode sombre : on assombrit les surfaces claires, le contraste reste vérifié ── */
  @media (prefers-color-scheme: dark) {
    .dm-bg { background-color: ${color.charcoal} !important; }
    .dm-surface { background-color: ${color.charcoalRaised} !important; }
    .dm-border { border-color: ${color.lineDark} !important; }
    .dm-text { color: ${color.onDark} !important; }
    .dm-muted { color: ${color.onDarkMuted} !important; }
  }
`;

/**
 * Wrappers fetch côté client avec gestion uniforme du 401 (session expirée).
 *
 * Quand l'API renvoie 401, on redirige automatiquement vers /login plutôt que
 * d'afficher un cryptique "Non autorisé". Le redirect est différé pour laisser
 * le composant montrer un toast d'information avant de quitter la page.
 */

import { signIn } from "next-auth/react";

/**
 * Comme `fetch`, mais détecte un 401 et déclenche un re-login.
 *
 * @returns la Response originale si !401, ou null si la session a été perdue
 *          (l'appelant ne devrait alors plus tenter de parser le body).
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    // Petite latence pour laisser un toast s'afficher si l'appelant en a un.
    setTimeout(() => signIn(undefined, { callbackUrl: window.location.href }), 1500);
    return null;
  }
  return res;
}

/**
 * Détecte si une erreur d'API correspond à une session expirée.
 * Si oui, déclenche le re-login après un court délai et retourne true.
 */
export function handleAuthError(status: number): boolean {
  if (status !== 401) return false;
  setTimeout(() => signIn(undefined, { callbackUrl: window.location.href }), 1500);
  return true;
}

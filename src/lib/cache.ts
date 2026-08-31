/**
 * Purge les caches du service worker (Cache Storage), en dernier recours
 * avant de reessayer un chargement de modele qui vient d'echouer.
 *
 * Les binaires du detecteur/classifieur (~10-35 Mo) sont mis en precache par
 * le service worker (voir vite.config.ts) pour fonctionner hors ligne - mais
 * une premiere installation interrompue en cours de route (reseau mobile
 * instable, proxy de compression d'un operateur) peut y laisser un fichier
 * tronque ou corrompu. Comme il reste servi depuis le cache indefiniment
 * (c'est le principe du mode hors ligne), un simple nouvel essai rejoue
 * alors le meme fichier casse et echoue a l'identique. Vider les caches
 * force le prochain essai a retelecharger un exemplaire propre depuis le
 * reseau.
 */
export async function purgerCachesModeles(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const noms = await caches.keys();
    await Promise.all(noms.map((n) => caches.delete(n)));
  } catch {
    // Best-effort : un echec ici ne doit pas empecher le nouvel essai, qui
    // tentera quand meme un rechargement normal.
  }
}

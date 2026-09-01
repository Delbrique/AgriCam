/**
 * Fonction serverless Vercel : /api/verifier-email
 *
 * Verifie qu'un domaine d'e-mail peut plausiblement recevoir du courrier
 * (enregistrement DNS MX, ou a defaut un enregistrement A) avant de
 * permettre une inscription a la communaute - un navigateur ne peut pas
 * faire de requete DNS lui-meme. Bloque les domaines inventes (ex.
 * "toto@toto.toto") qui passent la validation HTML5 basique d'un champ
 * <input type="email"> (elle ne verifie que la SYNTAXE, jamais que le
 * domaine existe reellement) - sans avoir a attendre l'envoi (et le
 * non-envoi) d'un mail de confirmation pour s'en rendre compte.
 *
 * Runtime Node (pas Edge) : le module "dns" n'existe que la.
 */

import dns from 'node:dns';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'Méthode non autorisée.' });
    return;
  }

  const corps: { email?: string } =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};

  const domaine = (corps.email ?? '').split('@')[1]?.trim().toLowerCase();
  if (!domaine) {
    res.status(200).json({ valide: false });
    return;
  }

  try {
    const enregistrementsMx = await dns.promises.resolveMx(domaine);
    res.status(200).json({ valide: enregistrementsMx.length > 0 });
  } catch {
    // Pas d'enregistrement MX : rare, mais certains domaines recoivent quand
    // meme du courrier via un enregistrement A simple - on verifie avant de
    // refuser, pour ne pas rejeter un domaine valide par erreur.
    try {
      await dns.promises.resolve4(domaine);
      res.status(200).json({ valide: true });
    } catch {
      res.status(200).json({ valide: false });
    }
  }
}

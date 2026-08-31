/**
 * Page de diagnostic - le coeur de l'application.
 *
 * Tout s'execute ici, dans le navigateur : controle qualite, detection,
 * classification, carte d'activation. Aucune requete reseau, aucune image
 * transmise.
 */

import { useCallback, useEffect, useState } from 'react';
import { VueCapture } from '../components/VueCapture';
import { FicheResultat } from '../components/FicheResultat';
import {
  diagnostiquer,
  PhotoRejetee,
  prechargerModeles,
  type Diagnostic as ResultatDiagnostic,
  type Progression,
} from '../lib/pipeline';
import { corriger, enregistrer, type Consultation } from '../lib/stockage';
import type { Qualite } from '../lib/qualite';
import { useTraduction, type Traductions } from '../lib/traduction';

export function Diagnostic() {
  const { t } = useTraduction();
  const [occupe, setOccupe] = useState(false);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [rejet, setRejet] = useState<{ qualite: Qualite; fichier: File } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le premier chargement des reseaux exige du reseau. On le declenche des
  // l'arrivee sur la page, tant que la connexion est la, pour que le
  // producteur ne decouvre pas le probleme au champ.
  useEffect(() => {
    if (navigator.onLine) {
      prechargerModeles().catch(() => {
        /* silencieux : l'echec sera signale au premier diagnostic */
      });
    }
  }, []);

  const lancer = useCallback(async (fichier: File, forcer = false) => {
    setErreur(null);
    setRejet(null);
    setOccupe(true);

    try {
      const image = await chargerImage(fichier, t.diagnostic.fichierIllisible);
      const position = await positionActuelle();

      const resultat = await diagnostiquer(image, {
        suivi: setProgression,
        position,
        forcer,
      });

      setConsultation(await enregistrer(resultat));
    } catch (e) {
      if (e instanceof PhotoRejetee) {
        setRejet({ qualite: e.qualite, fichier });
      } else {
        setErreur(messageErreurLisible(e, t));
      }
    } finally {
      setOccupe(false);
      setProgression(null);
    }
  }, [t]);

  async function surCorrection(_indexFruit: number, classeId: string) {
    if (consultation) await corriger(consultation.id, classeId);
  }

  if (consultation) {
    return (
      <FicheResultat
        diagnostic={consultation as ResultatDiagnostic}
        onRecommencer={() => setConsultation(null)}
        onCorriger={surCorrection}
      />
    );
  }

  return (
    <>
      <VueCapture onImage={lancer} occupe={occupe} progression={progression} />

      {rejet && (
        <div className="avis avis--attention">
          <p>{rejet.qualite.motif ? t.qualite[rejet.qualite.motif] : rejet.qualite.conseil}</p>
          <button
            className="bouton-second"
            onClick={() => lancer(rejet.fichier, true)}
          >
            {t.diagnostic.analyserQuandMeme}
          </button>
        </div>
      )}

      {erreur && <p className="avis avis--erreur">{erreur}</p>}
    </>
  );
}

/**
 * Traduit une erreur technique brute du navigateur en message comprehensible
 * pour un producteur - jamais "Load failed" (Safari) ou "Failed to execute
 * 'transaction' on 'IDBDatabase': The database connection is closing" tels
 * quels. Les messages qu'on ecrit nous-memes ailleurs (classifieur.ts,
 * detecteur.ts, classes.ts...) sont deja en francais clair et ne
 * correspondent a aucun de ces motifs : ils ressortent inchanges.
 */
function messageErreurLisible(e: unknown, t: Traductions): string {
  const brut = e instanceof Error ? e.message : '';

  if (/load failed|failed to fetch|networkerror|network request failed/i.test(brut)) {
    return t.diagnostic.erreurTelechargement;
  }
  if (/connection is clos/i.test(brut)) {
    return t.diagnostic.erreurEnregistrement;
  }
  if (/wasm|compileerror|doesn't parse|no available backend/i.test(brut)) {
    return t.diagnostic.erreurCorrompu;
  }
  if (!brut) {
    return t.diagnostic.erreurGenerique;
  }
  return brut;
}

function chargerImage(fichier: File, messageErreur: string): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error(messageErreur));
    };
    image.src = url;
  });
}

/** La position est facultative : un refus ne doit jamais bloquer le diagnostic. */
function positionActuelle(): Promise<{ latitude: number; longitude: number } | undefined> {
  return new Promise((resoudre) => {
    if (!navigator.geolocation) return resoudre(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resoudre({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resoudre(undefined),
      { timeout: 4000, maximumAge: 300000 },
    );
  });
}

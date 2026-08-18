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

export function Diagnostic() {
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
      const image = await chargerImage(fichier);
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
        setErreur(
          e instanceof Error
            ? e.message
            : 'Le diagnostic n’a pas abouti. Vérifiez que les modèles ont bien été téléchargés au moins une fois, avec une connexion.',
        );
      }
    } finally {
      setOccupe(false);
      setProgression(null);
    }
  }, []);

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
          <p>{rejet.qualite.conseil}</p>
          <button
            className="bouton-second"
            onClick={() => lancer(rejet.fichier, true)}
          >
            Analyser quand même
          </button>
        </div>
      )}

      {erreur && <p className="avis avis--erreur">{erreur}</p>}
    </>
  );
}

function chargerImage(fichier: File): Promise<HTMLImageElement> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error('Ce fichier n’est pas une image lisible.'));
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

/**
 * Conduite a tenir - le bloc « Que faire » du diagnostic.
 *
 * Affiche INSTANTANEMENT la conduite en dur (resume + gestes numerotes +
 * « a ne pas faire » + prevention) : le filet de securite au champ, toujours
 * disponible, avec ou sans reseau. Si l'appareil est en ligne, un conseil
 * personnalise (Groq) est demande en arriere-plan et remplace ce texte des
 * qu'il arrive, dans la MEME case plutot que dans une section separee - les
 * deux disaient a peu pres la meme chose, dans deux endroits differents. En
 * cas d'echec ou hors ligne, le texte en dur reste affiche : ce n'est jamais
 * un blocage, seulement une amelioration quand elle est possible.
 *
 * Le badge d'urgence vient toujours des donnees locales, meme quand le
 * corps affiche est celui genere par l'IA.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import { Volume2, VolumeX } from 'lucide-react';
import type { Classe, Gravite } from '../lib/classes';
import { conduitePour, LIBELLE_URGENCE, type Urgence } from '../data/conduites';
import { useTraduction, type Traductions } from '../lib/traduction';

const COULEUR_URGENCE: Record<Urgence, string> = {
  aucune: 'var(--sain)',
  surveiller: 'var(--alerte)',
  sous_48h: 'var(--atteint)',
  immediat: 'var(--grave)',
};

/** Libelles d'urgence localises - remplace LIBELLE_URGENCE (data/conduites.ts,
 * francais uniquement) pour l'affichage ; le texte long de la conduite elle-
 * meme (resume/gestes/eviter/prevention) reste francais pour l'instant, voir
 * la note dans le commentaire d'en-tete du fichier. */
function libelleUrgence(u: Urgence, t: Traductions): string {
  return {
    aucune: t.conduiteATenir.urgenceAucune,
    surveiller: t.conduiteATenir.urgenceSurveiller,
    sous_48h: t.conduiteATenir.urgenceSous48h,
    immediat: t.conduiteATenir.urgenceImmediat,
  }[u];
}

/** Le lecteur audio embarque du navigateur : fonctionne hors ligne, sans
 * dependance externe. Utile debout, au champ, une main occupee par le
 * fruit - ou pour un producteur qui lit peu ou mal le francais ecrit. */
const LECTURE_DISPONIBLE = typeof window !== 'undefined' && 'speechSynthesis' in window;

/* --- Mise en page du PDF -------------------------------------------------
 * Memes teintes que tokens.css, en RGB numerique : jsPDF n'accepte pas les
 * variables CSS. A tenir synchronise avec --sain/--alerte/--atteint/--grave. */
const ENCRE: [number, number, number] = [14, 26, 19];
const ENCRE_DOUCE: [number, number, number] = [74, 90, 81];
const TRAIT: [number, number, number] = [213, 219, 210];
const PAPIER: [number, number, number] = [242, 244, 239];

const FACTEUR_INTERLIGNE = 1.5;
const PT_VERS_MM = 25.4 / 72;

/** Hauteur occupee par une ligne de texte, en mm, pour un corps donne (en pt)
 * et l'interligne 1,5 impose sur tout le document. */
function hauteurLigne(taillePt: number): number {
  return taillePt * FACTEUR_INTERLIGNE * PT_VERS_MM;
}

function couleurGravitePdf(g: Gravite): [number, number, number] {
  return {
    sain: [31, 122, 77],
    alerte: [217, 138, 4],
    atteint: [179, 65, 26],
    grave: [110, 31, 20],
  }[g] as [number, number, number];
}

interface Props {
  classe: Classe;
  confiance: number;
  horodatage: number;
  /** Vignette Grad-CAM en dataURL (JPEG), pour l'illustration du PDF. */
  vignetteChaleur: string;
}

type EtatIA = 'inactif' | 'chargement' | 'pret' | 'erreur';

export function ConduiteATenir({ classe, confiance, horodatage, vignetteChaleur }: Props) {
  const { t } = useTraduction();
  const [replieOuvert, setReplieOuvert] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  const [etatIA, setEtatIA] = useState<EtatIA>('inactif');
  const [conseilIA, setConseilIA] = useState('');
  const [erreurIA, setErreurIA] = useState('');

  const conduite = conduitePour(classe.id);

  async function demanderConseilIA() {
    setEtatIA('chargement');
    setErreurIA('');
    try {
      const reponse = await fetch('/api/conseil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maladie: classe.nom,
          culture: classe.culture,
          agent: classe.agent ?? null,
          gravite: classe.gravite,
          confiance: Math.round(confiance * 100),
        }),
      });

      if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error(data.erreur ?? t.conduiteATenir.serviceIndisponible);
      }

      const data = await reponse.json();
      setConseilIA(data.conseil as string);
      setEtatIA('pret');
    } catch (e) {
      setErreurIA(e instanceof Error ? e.message : t.conduiteATenir.redactionEchouee);
      setEtatIA('erreur');
    }
  }

  // A chaque changement de maladie affichee (autre fruit selectionne,
  // nouvelle photo) : on repart du texte en dur, et on redemande la version
  // enrichie si le reseau est la.
  useEffect(() => {
    setConseilIA('');
    setEtatIA('inactif');
    if (navigator.onLine) demanderConseilIA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id]);

  // Coupe toute lecture en cours des que le diagnostic affiche change ou que
  // le composant disparait.
  useEffect(() => {
    return () => {
      if (LECTURE_DISPONIBLE) window.speechSynthesis.cancel();
    };
  }, [classe.id]);

  if (!conduite) return null;

  const { urgence, resume, gestes, eviter, prevention } = conduite;
  const conseilPret = etatIA === 'pret' && conseilIA.length > 0;

  function texteAudio(): string {
    if (conseilPret) {
      return conseilIA
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
    }
    return [
      `${classe.nom}.`,
      `${LIBELLE_URGENCE[urgence]}.`,
      resume,
      ...gestes,
      eviter ? `À ne pas faire : ${eviter}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  function basculerLecture() {
    if (!LECTURE_DISPONIBLE) return;
    if (enLecture) {
      window.speechSynthesis.cancel();
      setEnLecture(false);
      return;
    }

    const enonce = new SpeechSynthesisUtterance(texteAudio());
    enonce.lang = 'fr-FR';
    enonce.onend = () => setEnLecture(false);
    enonce.onerror = () => setEnLecture(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(enonce);
    setEnLecture(true);
  }

  function telechargerPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setLineHeightFactor(FACTEUR_INTERLIGNE);
    const margeX = 18;
    const largeurUtile = 210 - margeX * 2;
    const HAUT_PAGE = 20;
    const BAS_PAGE = 278;
    const couleurGrav = couleurGravitePdf(classe.gravite);
    let y = HAUT_PAGE;

    const sauterPageSiNecessaire = (hauteurBloc: number) => {
      if (y + hauteurBloc > BAS_PAGE) {
        doc.addPage();
        y = HAUT_PAGE;
      }
    };

    doc.setFillColor(...ENCRE);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(242, 244, 239);
    doc.text('AgriCam', margeX, 11);
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(185, 198, 189);
    doc.text('Conseil de traitement personnalise', margeX, 18);
    y = 24 + 10;

    const date = new Date(horodatage).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const lignesVerdict = [
      `Culture : ${classe.culture}`,
      classe.agent ? `Agent en cause : ${classe.agent}` : '',
      `Confiance du diagnostic : ${Math.min(99, Math.round(confiance * 100))} %`,
      `Date du diagnostic : ${date}`,
    ].filter(Boolean);
    const hauteurBox = 11 + lignesVerdict.length * hauteurLigne(12) + 4;

    doc.setDrawColor(...TRAIT);
    doc.setFillColor(...PAPIER);
    doc.roundedRect(margeX, y, largeurUtile, hauteurBox, 1.5, 1.5, 'FD');
    doc.setFillColor(...couleurGrav);
    doc.rect(margeX, y, 2, hauteurBox, 'F');

    const xTexteBox = margeX + 6;
    let yBox = y + 9;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...ENCRE);
    doc.text(classe.nom, xTexteBox, yBox);
    yBox += hauteurLigne(14);

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(lignesVerdict, xTexteBox, yBox);
    y += hauteurBox + 10;

    try {
      const cote = 48;
      sauterPageSiNecessaire(cote + 10);
      doc.setDrawColor(...TRAIT);
      doc.rect(margeX - 0.5, y - 0.5, cote + 1, cote + 1);
      doc.addImage(vignetteChaleur, 'JPEG', margeX, y, cote, cote);
      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...ENCRE_DOUCE);
      doc.text('Zones analysees (Grad-CAM)', margeX, y + cote + 5);
      y += cote + 12;
    } catch {
      /* si l'image ne peut pas etre integree, on continue sans elle */
    }

    const lignesLogiques = conseilIA
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    lignesLogiques.forEach((ligne) => {
      const estTitre =
        ligne.length > 5 &&
        ligne === ligne.toUpperCase() &&
        /[A-Z]/.test(ligne) &&
        !ligne.startsWith('-');
      const estPuce = ligne.startsWith('-');
      const indent = estPuce ? 4 : 0;
      const texteAffiche = estPuce ? ligne.replace(/^-\s*/, '') : ligne;

      if (estTitre) {
        sauterPageSiNecessaire(hauteurLigne(14) + 6);
        y += 4;
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...ENCRE);
        doc.text(texteAffiche, margeX, y);
        y += 2;
        doc.setDrawColor(...couleurGrav);
        doc.setLineWidth(0.5);
        doc.line(margeX, y, margeX + 30, y);
        doc.setLineWidth(0.2);
        y += 5;
        return;
      }

      const maxW = largeurUtile - indent;
      doc.setFont('times', 'normal');
      doc.setFontSize(12);
      const sousLignes = doc.splitTextToSize(texteAffiche, maxW) as string[];
      const hauteurBloc = sousLignes.length * hauteurLigne(12);

      sauterPageSiNecessaire(hauteurBloc);
      doc.setTextColor(...ENCRE);
      if (estPuce) {
        doc.text('•', margeX, y);
      }
      doc.text(texteAffiche, margeX + indent, y, {
        maxWidth: maxW,
        align: 'justify',
      });
      y += hauteurBloc;
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      doc.setDrawColor(...TRAIT);
      doc.line(margeX, 285, 210 - margeX, 285);
      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...ENCRE_DOUCE);
      doc.text(
        'Conseil genere par AgriCam — a confirmer par un technicien agricole en cas de doute.',
        margeX,
        290,
      );
      doc.text(`Page ${p} / ${totalPages}`, 210 - margeX, 290, {
        align: 'right',
      });
    }

    const nomFichier = `AgriCam_conseil_${classe.nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toLowerCase()}.pdf`;
    doc.save(nomFichier);
  }

  return (
    <section className="carte flex flex-col gap-e3 bp860:self-start">
      <div className="flex items-center justify-between gap-e3">
        <p className="intitule">{t.conduiteATenir.queFaire}</p>
        <div className="flex items-center gap-e2">
          {LECTURE_DISPONIBLE && (
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-0 bg-transparent text-encre-douce hover:bg-trait"
              onClick={basculerLecture}
              aria-pressed={enLecture}
              aria-label={enLecture ? t.conduiteATenir.arreterLecture : t.conduiteATenir.ecouterConsignes}
            >
              {enLecture ? (
                <VolumeX size={16} aria-hidden="true" />
              ) : (
                <Volume2 size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <span
            className="whitespace-nowrap rounded-sm px-e3 py-e1 font-donnee text-xs font-bold uppercase tracking-[0.06em] text-white"
            style={{ background: COULEUR_URGENCE[urgence] }}
          >
            {libelleUrgence(urgence, t)}
          </span>
        </div>
      </div>

      {conseilPret ? (
        <RapportFormate texte={conseilIA} />
      ) : (
        <>
          <p className="m-0 text-md leading-[1.45]">{resume}</p>

          <ol className="m-0 flex flex-col gap-e3 pl-[1.4rem] text-md leading-[1.45] marker:font-donnee marker:font-bold marker:text-encre-douce">
            {gestes.map((geste) => (
              <li key={geste}>{geste}</li>
            ))}
          </ol>

          {eviter && (
            <p className="m-0 rounded border-l-4 border-atteint bg-atteint-fond p-e3 text-sm leading-[1.45]">
              <strong>{t.conduiteATenir.aNePasFaire}</strong> {eviter}
            </p>
          )}

          {prevention && (
            <>
              <button
                className="min-h-[40px] self-start border-0 bg-transparent p-0 text-sm font-semibold text-encre underline underline-offset-[3px]"
                onClick={() => setReplieOuvert((v) => !v)}
                aria-expanded={replieOuvert}
              >
                {replieOuvert ? t.conduiteATenir.masquer : t.conduiteATenir.eviterQueCelaRevienne}
              </button>
              {replieOuvert && (
                <p className="m-0 text-sm leading-[1.45] text-encre-douce">{prevention}</p>
              )}
            </>
          )}
        </>
      )}

      {etatIA === 'chargement' && (
        <p className="m-0 text-xs text-encre-douce">{t.conduiteATenir.ameliorationEnCours}</p>
      )}

      {etatIA === 'erreur' && (
        <p className="m-0 text-xs text-encre-douce">
          {erreurIA} {t.conduiteATenir.conseilRestValable}{' '}
          <button
            className="border-0 bg-transparent p-0 text-xs font-semibold text-encre underline underline-offset-[3px]"
            onClick={demanderConseilIA}
          >
            {t.conduiteATenir.reessayer}
          </button>
        </p>
      )}

      {conseilPret && (
        <button
          className="min-h-[40px] self-start rounded border-0 bg-encre px-e4 text-sm font-semibold text-white hover:brightness-[1.12]"
          onClick={telechargerPdf}
        >
          {t.conduiteATenir.telechargerPdf}
        </button>
      )}
    </section>
  );
}

/**
 * Met en forme le texte brut renvoye par le modele :
 *   - une ligne tout en majuscules  -> titre de section
 *   - une ligne commencant par « - » -> puce d'une liste
 *   - le reste                       -> paragraphe
 */
function RapportFormate({ texte }: { texte: string }) {
  const lignes = texte
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const blocs: ReactNode[] = [];
  let puces: string[] = [];

  const viderPuces = (cle: string) => {
    if (puces.length) {
      const items = puces.slice();
      blocs.push(
        <ul key={`ul-${cle}`} className="m-0 flex flex-col gap-e2 pl-[1.15rem]">
          {items.map((p, i) => (
            <li key={i} className="text-sm leading-[1.5] text-encre">
              {p}
            </li>
          ))}
        </ul>,
      );
      puces = [];
    }
  };

  lignes.forEach((ligne, i) => {
    const estTitre =
      ligne.length > 5 &&
      ligne === ligne.toUpperCase() &&
      /[A-ZÀ-Ü]/.test(ligne) &&
      !ligne.startsWith('-');

    if (estTitre) {
      viderPuces(String(i));
      blocs.push(
        <h4
          key={`h-${i}`}
          className="mt-e2 border-b border-trait pb-e1 font-donnee text-xs font-bold uppercase tracking-[0.08em] text-encre first:mt-0"
        >
          {ligne}
        </h4>,
      );
    } else if (ligne.startsWith('-')) {
      puces.push(ligne.replace(/^-\s*/, ''));
    } else {
      viderPuces(String(i));
      blocs.push(
        <p key={`p-${i}`} className="m-0 text-sm leading-[1.55] text-encre">
          {ligne}
        </p>,
      );
    }
  });
  viderPuces('fin');

  return <div className="flex flex-col gap-e3">{blocs}</div>;
}

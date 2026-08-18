/**
 * Rapport detaille - affiche EN LIGNE dans la section « Recommandations ».
 *
 * Il ne se demande plus par un bouton : il se genere AUTOMATIQUEMENT a
 * l'affichage (le producteur en ligne veut le conseil, pas un bouton de plus).
 * Le texte revenu de Groq est mis en forme (titres de section + listes), et un
 * unique bouton permet de le telecharger en PDF - verdict et Grad-CAM compris.
 *
 * Le composant n'est monte que lorsque l'application est en ligne (c'est
 * FicheResultat qui en decide) ; hors ligne, la section n'apparait pas du
 * tout - la conduite en dur, dans la case « Que faire », reste le filet de
 * securite au champ.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import type { Classe, Gravite } from '../lib/classes';

/** Memes teintes que tokens.css, en RGB numerique : jsPDF n'accepte pas les
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

type Etat = 'chargement' | 'pret' | 'erreur';

export function ConseilDetaille({
  classe,
  confiance,
  horodatage,
  vignetteChaleur,
}: Props) {
  const [etat, setEtat] = useState<Etat>('chargement');
  const [conseil, setConseil] = useState('');
  const [erreur, setErreur] = useState('');

  async function demander() {
    setEtat('chargement');
    setErreur('');
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
        throw new Error(data.erreur ?? 'Le service de conseil est indisponible.');
      }

      const data = await reponse.json();
      setConseil(data.conseil as string);
      setEtat('pret');
    } catch (e) {
      setErreur(
        e instanceof Error
          ? e.message
          : 'La rédaction du conseil a échoué. Vérifiez votre connexion.',
      );
      setEtat('erreur');
    }
  }

  // Generation automatique a l'affichage, et a chaque changement de maladie
  // (utile en multi-fruits, quand on selectionne un autre fruit).
  useEffect(() => {
    demander();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id]);

  function telechargerPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setLineHeightFactor(FACTEUR_INTERLIGNE);
    const margeX = 18;
    const largeurUtile = 210 - margeX * 2;
    const HAUT_PAGE = 20;
    const BAS_PAGE = 278;
    const couleurGrav = couleurGravitePdf(classe.gravite);
    let y = HAUT_PAGE;

    /** Saut de page manuel : le bandeau/pied de page sont redessines a la fin,
     * sur chaque page, donc ici on ne fait que reserver la marge haute. */
    const sauterPageSiNecessaire = (hauteurBloc: number) => {
      if (y + hauteurBloc > BAS_PAGE) {
        doc.addPage();
        y = HAUT_PAGE;
      }
    };

    // --- Bandeau d'en-tete -------------------------------------------------
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

    // --- Encadre verdict, liseret colore selon la gravite ------------------
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

    // --- Vignette Grad-CAM, encadree ----------------------------------------
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

    // --- Corps du conseil ----------------------------------------------------
    // On travaille sur les lignes LOGIQUES (telles qu'ecrites, separees par
    // \n), pas sur un pre-decoupage global : la justification a besoin de
    // connaitre les frontieres de chaque paragraphe/puce pour ne pas etirer
    // sa derniere ligne (jsPDF ne justifie jamais la derniere ligne d'un
    // appel text() donne, ce qui est le comportement attendu).
    const lignesLogiques = conseil
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
        doc.text('\u2022', margeX, y);
      }
      doc.text(texteAffiche, margeX + indent, y, {
        maxWidth: maxW,
        align: 'justify',
      });
      y += hauteurBloc;
    });

    // --- Pied de page, sur chaque page --------------------------------------
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      doc.setDrawColor(...TRAIT);
      doc.line(margeX, 285, 210 - margeX, 285);
      doc.setFont('times', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...ENCRE_DOUCE);
      doc.text(
        'Conseil genere par AgriCam \u2014 a confirmer par un technicien agricole en cas de doute.',
        margeX,
        290,
      );
      doc.text(`Page ${p} / ${totalPages}`, 210 - margeX, 290, {
        align: 'right',
      });
    }

    const nomFichier = `AgriCam_conseil_${classe.nom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toLowerCase()}.pdf`;
    doc.save(nomFichier);
  }

  if (etat === 'chargement') {
    return (
      <p className="m-0 text-sm text-encre-douce">Rédaction du conseil en cours…</p>
    );
  }

  if (etat === 'erreur') {
    return (
      <div className="flex flex-col gap-e2 text-sm text-atteint">
        <p className="m-0">{erreur}</p>
        <button
          className="min-h-[40px] self-start rounded border-0 bg-encre px-e4 text-sm font-semibold text-white hover:brightness-[1.12]"
          onClick={demander}
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-e4">
      <RapportFormate texte={conseil} />
      <button
        className="min-h-[40px] self-start rounded border-0 bg-encre px-e4 text-sm font-semibold text-white hover:brightness-[1.12]"
        onClick={telechargerPdf}
      >
        Télécharger en PDF
      </button>
    </div>
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
      /[A-Z\u00c0-\u00dc]/.test(ligne) &&
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
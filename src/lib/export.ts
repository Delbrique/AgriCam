/**
 * Export du contenu local - CSV et PDF.
 *
 * Une ligne par consultation, jamais une photo : le CSV et le PDF restent
 * legers, et rien de plus que ce que l'utilisateur voit deja dans l'app
 * n'y figure. Aucun appel reseau - tout part de l'historique deja charge.
 */

import { jsPDF } from 'jspdf';
import { nomClasse } from './classes';
import type { Consultation } from './stockage';
import type { Traductions } from './traduction';

function principalDe(c: Consultation) {
  return c.fruits.find((f) => !f.horsSujet) ?? c.fruits[0];
}

export function echapperCsv(valeur: string): string {
  if (/[",\n]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`;
  return valeur;
}

const ENTETES_CSV = [
  'date',
  'culture',
  'maladie',
  'gravite',
  'confiance_pct',
  'fruits_analyses',
  'fruits_atteints',
  'latitude',
  'longitude',
];

export function genererCsv(
  consultations: Consultation[],
  t: Traductions,
  langue: 'fr' | 'en',
): string {
  const lignes = consultations.map((c) => {
    const principal = principalDe(c);
    const champs = [
      new Date(c.horodatage).toISOString(),
      principal.horsSujet ? '' : principal.classe.culture,
      principal.horsSujet ? t.export.horsSujetMinuscule : nomClasse(principal.classe, langue),
      principal.horsSujet ? '' : principal.classe.gravite,
      principal.horsSujet ? '' : String(Math.round(principal.confiance * 100)),
      String(c.fruits.length),
      String(c.nbAtteints),
      c.position ? String(c.position.latitude) : '',
      c.position ? String(c.position.longitude) : '',
    ];
    return champs.map(echapperCsv).join(',');
  });

  return [ENTETES_CSV.join(','), ...lignes].join('\n');
}

function telecharger(contenu: BlobPart, type: string, nomFichier: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}

export function exporterCsv(consultations: Consultation[], t: Traductions, langue: 'fr' | 'en'): void {
  const date = new Date().toISOString().slice(0, 10);
  // ﻿ : marqueur d'ordre des octets, pour qu'Excel reconnaisse l'UTF-8
  // et n'affiche pas les accents comme des caracteres corrompus.
  telecharger(
    '﻿' + genererCsv(consultations, t, langue),
    'text/csv;charset=utf-8',
    `agricam_historique_${date}.csv`,
  );
}

const ENCRE: [number, number, number] = [26, 28, 25];
const ENCRE_DOUCE: [number, number, number] = [66, 72, 68];
const TRAIT: [number, number, number] = [194, 200, 194];

export function exporterPdf(consultations: Consultation[], t: Traductions, langue: 'fr' | 'en'): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margeX = 14;
  const largeurUtile = 210 - margeX * 2;
  const HAUT_PAGE = 20;
  const BAS_PAGE = 285;
  let y = HAUT_PAGE;
  const localeDate = langue === 'en' ? 'en-US' : 'fr-FR';

  doc.setFillColor(...ENCRE);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(242, 244, 239);
  doc.text(t.export.titrePdf, margeX, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(185, 198, 189);
  doc.text(
    t.export.resumePdf(consultations.length, new Date().toLocaleDateString(localeDate)),
    margeX,
    17,
  );
  y = 22 + 10;

  const colonnes = [
    { titre: t.export.colDate, largeur: 26 },
    { titre: t.export.colCulture, largeur: 22 },
    { titre: t.export.colDiagnostic, largeur: 62 },
    { titre: t.export.colConfiance, largeur: 22 },
    { titre: t.export.colFruits, largeur: 34 },
  ];

  function enteteTableau() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ENCRE);
    let x = margeX;
    colonnes.forEach((col) => {
      doc.text(col.titre, x, y);
      x += col.largeur;
    });
    y += 2;
    doc.setDrawColor(...TRAIT);
    doc.line(margeX, y, margeX + largeurUtile, y);
    y += 5;
  }

  enteteTableau();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  consultations.forEach((c) => {
    if (y > BAS_PAGE) {
      doc.addPage();
      y = HAUT_PAGE;
      enteteTableau();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }

    const principal = principalDe(c);
    const ligne = [
      new Date(c.horodatage).toLocaleDateString(localeDate, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      }),
      principal.horsSujet ? '—' : principal.classe.culture,
      principal.horsSujet ? t.export.horsSujet : nomClasse(principal.classe, langue),
      principal.horsSujet ? '—' : `${Math.min(99, Math.round(principal.confiance * 100))}%`,
      t.export.fruitsAtteints(c.nbAtteints, c.fruits.length),
    ];

    doc.setTextColor(...ENCRE);
    let x = margeX;
    ligne.forEach((valeur, i) => {
      const largeurCol = colonnes[i].largeur - 2;
      const texte = doc.splitTextToSize(valeur, largeurCol) as string[];
      doc.text(texte[0] ?? '', x, y);
      x += colonnes[i].largeur;
    });
    y += 6;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(t.export.footerPdf, margeX, 292);
    doc.text(t.export.page(p, totalPages), 210 - margeX, 292, { align: 'right' });
  }

  doc.save(`agricam_historique_${new Date().toISOString().slice(0, 10)}.pdf`);
}

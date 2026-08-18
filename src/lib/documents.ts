/**
 * Extraction de texte cote client, pour joindre un document a l'assistant.
 *
 * Chaque fonction importe sa librairie DYNAMIQUEMENT (pdfjs-dist, mammoth) :
 * ces dependances ne doivent pas alourdir le chargement initial d'une
 * application pensee pour des telephones d'entree de gamme. Elles ne sont
 * telechargees que si le producteur joint effectivement un fichier.
 */

const TAILLE_MAX_TEXTE = 6000;

async function extraireTextePdf(fichier: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const tampon = await fichier.arrayBuffer();
  const document = await pdfjsLib.getDocument({ data: tampon }).promise;

  let texte = '';
  for (let p = 1; p <= document.numPages && texte.length < TAILLE_MAX_TEXTE; p += 1) {
    const page = await document.getPage(p);
    const contenu = await page.getTextContent();
    texte +=
      contenu.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ') + '\n';
  }
  return texte.slice(0, TAILLE_MAX_TEXTE).trim();
}

async function extraireTexteDocx(fichier: File): Promise<string> {
  const mammoth = await import('mammoth');
  const tampon = await fichier.arrayBuffer();
  const resultat = await mammoth.extractRawText({ arrayBuffer: tampon });
  return resultat.value.slice(0, TAILLE_MAX_TEXTE).trim();
}

async function extraireTexteBrut(fichier: File): Promise<string> {
  const texte = await fichier.text();
  return texte.slice(0, TAILLE_MAX_TEXTE).trim();
}

/** Repartit vers le bon extracteur selon le type de fichier. Le .doc binaire
 * (pre-2007) n'est volontairement pas supporte : seul le .docx (XML) l'est. */
export async function extraireTexte(fichier: File): Promise<string> {
  const nom = fichier.name.toLowerCase();

  if (fichier.type === 'application/pdf' || nom.endsWith('.pdf')) {
    return extraireTextePdf(fichier);
  }
  if (
    fichier.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    nom.endsWith('.docx')
  ) {
    return extraireTexteDocx(fichier);
  }
  if (nom.endsWith('.doc')) {
    throw new Error(
      'Le format .doc (Word 97-2003) n’est pas pris en charge : enregistrez le fichier en .docx.',
    );
  }
  return extraireTexteBrut(fichier);
}

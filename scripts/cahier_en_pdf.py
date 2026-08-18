"""
Compose le cahier des charges en PDF.

Markdown -> HTML mis en page -> wkhtmltopdf.

Contrainte a connaitre : wkhtmltopdf s'appuie sur un WebKit ancien. Ni les
variables CSS, ni la grille, ni flexbox n'y sont fiables. La feuille de style
ci-dessous s'en tient donc a des couleurs litterales et a un flux classique -
c'est volontaire, pas de la negligence.
"""

from __future__ import annotations

import pathlib
import re
import subprocess

import markdown

RACINE = pathlib.Path(__file__).resolve().parent.parent
SOURCE = RACINE / "CAHIER_DES_CHARGES.md"
HTML = RACINE / "_cahier.html"
PDF = RACINE / "AgriCam_cahier_des_charges.pdf"

# Palette du projet, reprise a l'identique de l'application.
STYLE = """
@page { margin: 20mm 18mm 18mm 18mm; }

body {
  font-family: "Bitstream Charter", "DejaVu Serif", Georgia, serif;
  font-size: 10.5pt;
  line-height: 1.55;
  color: #0e1a13;
  margin: 0;
}

/* --- Couverture ------------------------------------------------------- */
.couverture {
  page-break-after: always;
  padding-top: 55mm;
  text-align: center;
}
.couverture .titre {
  font-family: "DejaVu Sans", sans-serif;
  font-size: 34pt;
  font-weight: bold;
  letter-spacing: -1px;
  margin: 0;
}
.couverture .sous-titre {
  font-size: 13pt;
  color: #4a5a51;
  margin: 6mm 0 0;
  font-style: italic;
}
.couverture .filet {
  width: 60mm;
  height: 3px;
  background: #0e1a13;
  margin: 12mm auto;
}
.couverture .bande {
  margin: 14mm auto 0;
  width: 90mm;
  height: 16px;
  border: 1px solid #0e1a13;
  font-size: 0;
}
.couverture .bande span { display: inline-block; height: 100%; }
.couverture .meta {
  margin-top: 16mm;
  font-family: "DejaVu Sans Mono", monospace;
  font-size: 9pt;
  color: #4a5a51;
  line-height: 2;
}

/* --- Titres ------------------------------------------------------------ */
h1 {
  font-family: "DejaVu Sans", sans-serif;
  font-size: 17pt;
  border-bottom: 2px solid #0e1a13;
  padding-bottom: 2mm;
  margin: 12mm 0 5mm;
  page-break-after: avoid;
}
h1:first-of-type { margin-top: 0; }
h2 {
  font-family: "DejaVu Sans", sans-serif;
  font-size: 12.5pt;
  margin: 8mm 0 3mm;
  page-break-after: avoid;
}
h3 {
  font-family: "DejaVu Sans", sans-serif;
  font-size: 11pt;
  color: #1f7a4d;
  margin: 6mm 0 2mm;
  page-break-after: avoid;
}

p { margin: 0 0 3mm; text-align: justify; }

/* --- Tableaux ---------------------------------------------------------- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0 6mm;
  font-size: 9pt;
  page-break-inside: avoid;
}
th {
  background: #0e1a13;
  color: #f2f4ef;
  font-family: "DejaVu Sans", sans-serif;
  font-size: 8.5pt;
  text-align: left;
  padding: 2mm 2.5mm;
}
td {
  border-bottom: 0.5pt solid #d5dbd2;
  padding: 1.8mm 2.5mm;
  vertical-align: top;
}
tr:nth-child(even) td { background: #f7f9f5; }

/* --- Citations : les points de vigilance ------------------------------- */
blockquote {
  margin: 4mm 0;
  padding: 3mm 4mm;
  background: #f2f4ef;
  border-left: 3px solid #1f7a4d;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
blockquote p:last-child { margin-bottom: 0; }

code {
  font-family: "DejaVu Sans Mono", monospace;
  font-size: 8.5pt;
  background: #eceeea;
  padding: 0.3mm 1mm;
}
pre {
  background: #0e1a13;
  color: #f2f4ef;
  padding: 4mm;
  font-size: 8pt;
  line-height: 1.4;
  page-break-inside: avoid;
  overflow: hidden;
}
pre code { background: none; color: inherit; font-size: 8pt; }

ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1.5mm; }

hr { border: none; border-top: 0.5pt solid #d5dbd2; margin: 8mm 0; }

strong { font-weight: bold; }

/* Les pictogrammes ne rendent pas de facon fiable avec les polices
   embarquees : on leur substitue des libelles, plus lisibles de toute facon
   dans un document destine a etre imprime. */
.etat {
  font-family: "DejaVu Sans", sans-serif;
  font-size: 7.5pt;
  font-weight: bold;
  padding: 0.4mm 1.5mm;
  white-space: nowrap;
  color: #ffffff;
}
.etat-fait   { background: #1f7a4d; }
.etat-cours  { background: #d98a04; }
.etat-todo   { background: #ffffff; color: #4a5a51; border: 0.5pt solid #d5dbd2; }
.vedette { color: #d98a04; font-weight: bold; }
"""

# La bande de severite de l'application, reprise en couverture.
SEGMENTS = [("#1f7a4d", 34), ("#d98a04", 14), ("#b3411a", 34), ("#6e1f14", 18)]

COUVERTURE = f"""
<div class="couverture">
  <p class="titre">AgriCam</p>
  <p class="sous-titre">Cahier des charges</p>
  <div class="filet"></div>
  <p>Diagnostic phytosanitaire explicable des cultures maraicheres,<br>
     fonctionnant sans reseau</p>
  <div class="bande">
    {''.join(f'<span style="background:{c};width:{w}%"></span>' for c, w in SEGMENTS)}
  </div>
  <p class="meta">
    Version 1.0 &middot; 25 juillet 2026<br>
    Tomate &middot; Piment &middot; Oignon &middot; 9 etats sanitaires<br>
    Memoire de fin de cycle &middot; Bachelor IA &amp; Big Data
  </p>
</div>
"""


def convertir() -> None:
    texte = SOURCE.read_text(encoding="utf-8")

    # L'en-tete du markdown est remplace par la page de couverture.
    texte = re.sub(r"\A.*?^---\s*$", "", texte, count=1, flags=re.S | re.M)

    corps = markdown.markdown(
        texte,
        extensions=["tables", "fenced_code", "attr_list", "sane_lists"],
    )

    for motif, remplacement in (
        ("\u2705", '<span class="etat etat-fait">Fait</span>'),
        ("\U0001f528", '<span class="etat etat-cours">En cours</span>'),
        ("\u2b1c", '<span class="etat etat-todo">A faire</span>'),
        ("\u2b50", '<span class="vedette">&#9733;</span>'),
    ):
        corps = corps.replace(motif, remplacement)

    HTML.write_text(
        f"<!doctype html><html lang='fr'><head><meta charset='utf-8'>"
        f"<style>{STYLE}</style></head><body>{COUVERTURE}{corps}</body></html>",
        encoding="utf-8",
    )

    subprocess.run(
        [
            "wkhtmltopdf",
            "--encoding", "utf-8",
            "--enable-local-file-access",
            "--print-media-type",
            "--margin-top", "18mm",
            "--margin-bottom", "16mm",
            "--margin-left", "16mm",
            "--margin-right", "16mm",
            "--footer-font-name", "DejaVu Sans",
            "--footer-font-size", "7",
            "--footer-left", "AgriCam - Cahier des charges",
            "--footer-right", "[page] / [topage]",
            "--footer-spacing", "6",
            "--footer-line",
            "--title", "AgriCam - Cahier des charges",
            "--quiet",
            str(HTML),
            str(PDF),
        ],
        check=True,
    )

    HTML.unlink(missing_ok=True)
    numeroter(PDF)
    print(f"{PDF}  ({PDF.stat().st_size / 1024:.0f} Ko)")


def numeroter(chemin: pathlib.Path) -> None:
    """
    Appose un pied de page sur chaque page, couverture exceptee.

    Le binaire wkhtmltopdf disponible ici n'est pas compile avec le support des
    en-tetes et pieds de page : les options correspondantes sont ignorees en
    silence. On superpose donc le pied de page apres coup.
    """
    from io import BytesIO

    from pypdf import PdfReader, PdfWriter
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    lecteur = PdfReader(chemin)
    total = len(lecteur.pages)
    ecrivain = PdfWriter()

    for numero, page in enumerate(lecteur.pages, start=1):
        if numero > 1:
            tampon = BytesIO()
            c = canvas.Canvas(tampon, pagesize=A4)
            largeur, _ = A4

            c.setStrokeColorRGB(0.835, 0.859, 0.824)
            c.setLineWidth(0.5)
            c.line(45, 42, largeur - 45, 42)

            c.setFont("Helvetica", 7)
            c.setFillColorRGB(0.29, 0.35, 0.32)
            c.drawString(45, 32, "AgriCam \u2014 Cahier des charges")
            c.drawRightString(largeur - 45, 32, f"{numero} / {total}")
            c.save()

            tampon.seek(0)
            page.merge_page(PdfReader(tampon).pages[0])

        ecrivain.add_page(page)

    with open(chemin, "wb") as sortie:
        ecrivain.write(sortie)


if __name__ == "__main__":
    convertir()

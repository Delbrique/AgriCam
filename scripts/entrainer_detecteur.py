"""
================================================================================
 AgriCam - reentrainement du detecteur de fruits (YOLOv8n)
================================================================================

Le fichier best.pt de l'entrainement precedent a ete perdu, mais le jeu annote
en boites a survecu (data/fruits/tomate/data.yaml). Ce script le reentraine et
l'exporte directement au format attendu par l'application.

    conda activate agricam
    pip install ultralytics onnx onnxsim
    cd Documents\\VENV\\bases_python\\Soutenance\\agricam
    python scripts\\entrainer_detecteur.py

Comptez une a deux heures sur une RTX 3050. Vous pouvez fermer VS Code, mais
pas le terminal.

--------------------------------------------------------------------------------
 CHOIX D'ARCHITECTURE
--------------------------------------------------------------------------------
YOLOv8n (nano) : environ 3,2 M de parametres, 6 Mo. C'est le plus leger de la
famille, et ce choix decoule directement de l'objectif : le detecteur doit
cohabiter avec EfficientNetB3 dans le navigateur d'un telephone d'entree de
gamme. La variante `s` (small) serait un peu plus precise pour un cout triple -
a envisager seulement si la mAP obtenue s'averait insuffisante.

La resolution est de 640 x 640, standard YOLO, distincte du 224 x 224 du
classifieur : les deux reseaux operent a des echelles differentes.
================================================================================
"""

from __future__ import annotations

import pathlib
import shutil

import yaml

IGNORES = {"node_modules", ".git", "__pycache__", "runs_agricam"}

EPOQUES = 50
COTE = 640
LOT = 16          # ramener a 8 en cas d'erreur memoire sur 6 Go de VRAM
PATIENCE = 10
SEED = 42


def racines() -> list[pathlib.Path]:
    vues: set[pathlib.Path] = set()
    sortie: list[pathlib.Path] = []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


def trouver_yaml() -> pathlib.Path:
    for racine in racines():
        for chemin in racine.glob("**/data.yaml"):
            if not any(p in IGNORES for p in chemin.parts):
                print(f"  [ok] jeu annote : {chemin}")
                return chemin
    raise SystemExit(
        "\n[MANQUANT] data.yaml introuvable.\n"
        "           Attendu vers data/fruits/tomate/data.yaml"
    )


def reparer_yaml(original: pathlib.Path) -> pathlib.Path:
    """
    Reecrit le data.yaml avec des chemins absolus.

    Les fichiers exportes par Roboflow contiennent des chemins relatifs penses
    pour leur propre arborescence (`../train/images`). Executes ailleurs, ils
    envoient Ultralytics chercher les images au mauvais endroit - et l'erreur
    n'apparait qu'apres plusieurs minutes de chargement. On repare en amont.
    """
    racine = original.parent
    config = yaml.safe_load(original.read_text(encoding="utf-8"))

    for cle in ("train", "val", "test"):
        valeur = config.get(cle)
        if not valeur:
            continue
        chemin = pathlib.Path(str(valeur).replace("../", ""))
        absolu = (racine / chemin).resolve()

        # Certains exports pointent vers le dossier parent des images.
        if not absolu.exists() and (absolu / "images").exists():
            absolu = absolu / "images"
        if not absolu.exists():
            candidats = list(racine.glob(f"**/{cle}/images"))
            if candidats:
                absolu = candidats[0].resolve()

        config[cle] = str(absolu)
        etat = "ok" if absolu.exists() else "ABSENT"
        print(f"       {cle:<6} -> {absolu}   [{etat}]")

    config.pop("path", None)  # sinon Ultralytics le prefixe aux chemins absolus

    corrige = racine / "data_agricam.yaml"
    corrige.write_text(yaml.safe_dump(config, allow_unicode=True), encoding="utf-8")
    print(f"  [ok] configuration corrigee : {corrige}")
    print(f"       classes : {config.get('names')}")
    return corrige


def entrainer(config: pathlib.Path):
    from ultralytics import YOLO

    modele = YOLO("yolov8n.pt")   # poids COCO : point de depart du transfert
    resultats = modele.train(
        data=str(config),
        epochs=EPOQUES,
        imgsz=COTE,
        batch=LOT,
        device=0,
        patience=PATIENCE,
        seed=SEED,
        project="runs_agricam",
        name="yolov8n_fruits",
        exist_ok=True,
        plots=True,          # courbes et matrice de confusion pour le rapport
        verbose=True,
    )
    return modele, resultats


def evaluer(modele, config: pathlib.Path) -> None:
    """
    La detection ne s'evalue pas comme la classification.

    La metrique de reference est la mAP, qui combine precision et rappel avec
    la qualite du recouvrement entre boite predite et boite reelle.
      mAP50    : recouvrement d'au moins 50 % - capacite a TROUVER l'objet.
      mAP50-95 : moyenne de 50 a 95 % - precision du CADRAGE, bien plus severe.
    Reperes : mAP50 > 0,80 est bon ; mAP50-95 > 0,50 est solide. Ces valeurs
    sont structurellement plus basses que des scores de classification - les
    deux taches ne sont pas comparables.
    """
    metriques = modele.val(data=str(config), device=0, verbose=False)

    print("\n" + "=" * 52)
    print(" METRIQUES DE DETECTION")
    print("=" * 52)
    print(f"  mAP50      : {metriques.box.map50:.4f}")
    print(f"  mAP50-95   : {metriques.box.map:.4f}")
    print(f"  Precision  : {metriques.box.mp:.4f}")
    print(f"  Rappel     : {metriques.box.mr:.4f}")

    print("\n mAP50 par classe :")
    for i, ap in enumerate(metriques.box.ap50):
        print(f"  {modele.names[i]:<26} : {ap:.4f}")


def exporter(modele) -> None:
    """Export ONNX, format lu directement par onnxruntime-web."""
    chemin = modele.export(format="onnx", imgsz=COTE, opset=12, simplify=True)

    cible = pathlib.Path.cwd() / "public" / "models"
    cible.mkdir(parents=True, exist_ok=True)
    shutil.copy(chemin, cible / "detecteur.onnx")

    poids = (cible / "detecteur.onnx").stat().st_size / 1024 ** 2
    print(f"\n  [ok] detecteur.onnx exporte ({poids:.1f} Mo) dans {cible}")


if __name__ == "__main__":
    print("Recherche du jeu annote...\n")
    config = reparer_yaml(trouver_yaml())

    print("\nDemarrage de l'entrainement. Comptez une a deux heures.\n")
    modele, _ = entrainer(config)

    evaluer(modele, config)
    exporter(modele)

    dossier = pathlib.Path("runs_agricam/yolov8n_fruits")
    print(f"\nFigures pour le rapport, dans {dossier} :")
    for f in sorted(dossier.glob("*.png")):
        print(f"   {f.name}")
    print(f"\nPoids conserves : {dossier / 'weights' / 'best.pt'}")
    print("SAUVEGARDEZ CE FICHIER AILLEURS. C'est celui qui avait ete perdu.")

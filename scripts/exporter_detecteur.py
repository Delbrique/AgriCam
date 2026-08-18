"""
================================================================================
 AgriCam - export du detecteur YOLO vers ONNX
================================================================================

A executer dans l'environnement `yolo`, PAS dans `agricam`.

    conda create -n yolo python=3.10 -y
    conda activate yolo
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install ultralytics onnx onnxsim

    cd Documents\\VENV\\bases_python\\Soutenance\\agricam
    python scripts\\exporter_detecteur.py

--------------------------------------------------------------------------------
 POURQUOI UN ENVIRONNEMENT SEPARE
--------------------------------------------------------------------------------
L'environnement `agricam` est bati autour de TensorFlow 2.10, qui impose
CUDA 11.2 et cuDNN 8.1. PyTorch, tire par ultralytics, reclame ses propres
bibliotheques CUDA d'une autre version. Les deux se disputent le meme dossier
de DLL, et le chargement echoue :

    OSError: [WinError 127] ... cublas64_11.dll

On ne repare pas cette collision, on l'evite. Et comme l'export ne fait que
convertir un fichier de 6 Mo, le GPU n'apporte rien : PyTorch en version CPU
suffit, et il n'embarque aucune DLL CUDA - donc plus rien a se disputer.

Ce script n'importe jamais TensorFlow, par construction.
================================================================================
"""

from __future__ import annotations

import pathlib
import shutil

IGNORES = {"node_modules", ".git", "__pycache__"}
COTE = 640          # resolution YOLO, distincte du 224 du classifieur


def racines() -> list[pathlib.Path]:
    vues: set[pathlib.Path] = set()
    sortie: list[pathlib.Path] = []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


def trouver_poids() -> pathlib.Path:
    """
    Cherche le detecteur entraine.

    Attention : yolov8n.pt et yolo26n.pt sont les poids COCO d'origine, ils
    detectent des personnes et des voitures. Ils sont volontairement exclus
    des motifs ci-dessous.
    """
    motifs = [
        "agricam_yolo_tomate.pt",
        "modeles/agricam_yolo_tomate.pt",
        "runs_agricam/*/weights/best.pt",
        "**/runs_agricam/*/weights/best.pt",
        "**/weights/best.pt",
    ]
    for racine in racines():
        for motif in motifs:
            candidats = [
                c for c in sorted(racine.glob(motif))
                if c.is_file() and not any(p in IGNORES for p in c.parts)
            ]
            if candidats:
                poids = candidats[0]
                print(f"  [ok] detecteur : {poids}")
                print(f"       taille    : {poids.stat().st_size / 1024 ** 2:.1f} Mo")
                return poids

    raise SystemExit(
        "\n[MANQUANT] detecteur entraine introuvable.\n"
        "           Attendu : modeles/agricam_yolo_tomate.pt\n"
        "           ou runs/detect/runs_agricam/yolov8n_tomate/weights/best.pt\n"
        "           N'utilisez pas yolov8n.pt : ce sont les poids COCO."
    )


def dossier_sortie() -> pathlib.Path:
    """Trouve le public/models du projet, ou le cree a cote."""
    for racine in racines():
        candidat = racine / "public" / "models"
        if candidat.is_dir():
            return candidat
    cible = pathlib.Path.cwd() / "public" / "models"
    cible.mkdir(parents=True, exist_ok=True)
    return cible


if __name__ == "__main__":
    print("Recherche du detecteur...\n")
    poids = trouver_poids()

    from ultralytics import YOLO

    modele = YOLO(str(poids))

    print(f"\n  Classes du detecteur : {modele.names}")
    print(f"  Nombre de classes    : {len(modele.names)}")

    print("\n  Conversion vers ONNX...")
    # opset 12 : le plus haut niveau pleinement supporte par onnxruntime-web.
    # simplify : fusionne les operations redondantes, allege le graphe.
    chemin = modele.export(format="onnx", imgsz=COTE, opset=12, simplify=True)

    cible = dossier_sortie()
    destination = cible / "detecteur.onnx"
    shutil.copy(chemin, destination)

    poids_mo = destination.stat().st_size / 1024 ** 2
    print(f"\n  [ok] {destination}  ({poids_mo:.1f} Mo)")

    print("\nContenu de public/models/ :")
    total = 0
    for f in sorted(cible.rglob("*")):
        if f.is_file():
            total += f.stat().st_size
            print(f"   {f.relative_to(cible)}  ({f.stat().st_size / 1024:.0f} Ko)")
    print(f"\nPoids total a telecharger par le producteur : {total / 1024 ** 2:.1f} Mo")
    print("\nRepassez ensuite dans l'environnement agricam : conda activate agricam")

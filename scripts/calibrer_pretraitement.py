"""
================================================================================
 AgriCam - calibrage du pretraitement
================================================================================

Les poids sont integralement charges (499 / 499 tenseurs), mais l'exactitude
plafonne a 75,6 % alors que l'entrainement annoncait 95,89 %. La confiance
moyenne reste haute (90,4 %) : le modele est sur de lui et se trompe, ce qui
designe un desaccord de PRETRAITEMENT, non un probleme de poids.

Deux variables peuvent differer entre l'entrainement et cette verification :

  - L'ECHELLE DES PIXELS. EfficientNet embarque sa propre normalisation, donc
    on l'alimente en [0, 255]. Mais si la couche `data_augmentation` du modele
    entraine contenait un `Rescaling(1/255)`, celui-ci resterait actif en
    inference - contrairement aux transformations aleatoires - et il faudrait
    le reproduire ici.

  - LA METHODE DE REDIMENSIONNEMENT. `keras.utils.load_img` utilise `nearest`
    par defaut, la ou `image_dataset_from_directory` utilise du bilineaire. Sur
    des lesions fines, la difference n'est pas anodine.

Ce script mesure les quatre combinaisons sur le meme echantillon. Celle qui
retrouve l'exactitude d'entrainement est la bonne : c'est elle qu'il faudra
reproduire dans l'application.

    conda activate agricam
    cd Documents\\VENV\\bases_python\\Soutenance\\agricam
    python scripts\\calibrer_pretraitement.py
================================================================================
"""

from __future__ import annotations

import json
import pathlib
import random

import numpy as np
import tensorflow as tf
from tensorflow import keras

from chargement_poids import charger_poids, controler

COTE = 224
NB_IMAGES = 270          # une trentaine par classe
SEED = 42

IGNORES = {"node_modules", ".git", "__pycache__", "dist", "public", "site-packages"}


def racines() -> list[pathlib.Path]:
    vues: set[pathlib.Path] = set()
    sortie: list[pathlib.Path] = []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


def acceptable(chemin: pathlib.Path) -> bool:
    return not any(p in IGNORES for p in chemin.parts)


def trouver_fichier(motifs: list[str], description: str) -> pathlib.Path:
    for racine in racines():
        for motif in motifs:
            candidats = [
                c for c in sorted(racine.glob(motif)) + sorted(racine.glob(f"**/{motif}"))
                if c.is_file() and acceptable(c)
            ]
            if candidats:
                print(f"  [ok] {description:<24} {candidats[0]}")
                return candidats[0]
    raise SystemExit(f"\n[MANQUANT] {description}")


def trouver_donnees(classes: list[str]) -> pathlib.Path:
    for racine in racines():
        for nom in classes:
            for candidat in racine.glob(f"**/{nom}"):
                if candidat.is_dir() and acceptable(candidat):
                    if any(candidat.glob("*.jpg")) or any(candidat.glob("*.png")):
                        print(f"  [ok] {'jeu d images':<24} {candidat.parent}")
                        return candidat.parent
    raise SystemExit("\n[MANQUANT] jeu d'images")


def construire(nb_classes: int) -> keras.Model:
# `weights="imagenet"` et non None : la couche Normalization d'EfficientNet
    # fige ses statistiques en constantes des le build. Construite a vide, elle
    # normaliserait avec 0 et 1, et le chargement ulterieur des poids ne
    # corrigerait que les variables, pas les constantes.
    base = keras.applications.EfficientNetB3(
        include_top=False, weights="imagenet", input_shape=(COTE, COTE, 3)
    )
    entree = keras.Input(shape=(COTE, COTE, 3))
    x = base(entree, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = keras.layers.Dropout(0.3, name="top_dropout")(x)
    sortie = keras.layers.Dense(nb_classes, activation="softmax", name="predictions")(x)
    return keras.Model(entree, sortie, name="AgriCam")


def echantillonner(dossier: pathlib.Path, classes: list[str]):
    random.seed(SEED)
    par_classe = max(6, NB_IMAGES // len(classes))
    echantillon = []
    for indice, nom in enumerate(classes):
        sous = dossier / nom
        if not sous.is_dir():
            continue
        images = [
            p for p in sous.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        ]
        for p in random.sample(images, min(par_classe, len(images))):
            echantillon.append((p, indice))
    return echantillon


def charger_pil(chemins, interpolation: str) -> np.ndarray:
    """Voie PIL, celle de keras.utils.load_img."""
    lot = np.zeros((len(chemins), COTE, COTE, 3), dtype="float32")
    for i, chemin in enumerate(chemins):
        image = keras.utils.load_img(
            chemin, target_size=(COTE, COTE), interpolation=interpolation
        )
        lot[i] = keras.utils.img_to_array(image)
    return lot


def charger_tf(chemins, anticrenelage: bool = False) -> np.ndarray:
    """
    Voie TensorFlow, celle d'image_dataset_from_directory.

    C'est le chemin exact suivi pendant l'entrainement : decodage par
    tf.io.decode_image, puis tf.image.resize en bilineaire.

    Le parametre `antialias` merite une remarque. Par defaut, tf.image.resize
    NE FILTRE PAS lors d'une reduction : il echantillonne, ce qui laisse du
    crenelage sur les textures fines - typiquement les bords d'une lesion.
    PIL, lui, filtre toujours. Les deux voies produisent donc des images
    differentes a partir du meme fichier, et un reseau entraine sur l'une peut
    perdre plusieurs points sur l'autre.
    """
    lot = np.zeros((len(chemins), COTE, COTE, 3), dtype="float32")
    for i, chemin in enumerate(chemins):
        octets = tf.io.read_file(str(chemin))
        image = tf.io.decode_image(octets, channels=3, expand_animations=False)
        image = tf.image.resize(
            image, [COTE, COTE], method="bilinear", antialias=anticrenelage
        )
        lot[i] = image.numpy()
    return lot


if __name__ == "__main__":
    print("Recherche des fichiers :\n")
    chemin_classes = trouver_fichier(["class_names.json"], "noms des classes")
    classes = json.loads(chemin_classes.read_text(encoding="utf-8"))
    if isinstance(classes, dict):
        classes = [classes[c] for c in sorted(classes, key=int)]

    dossier = trouver_donnees(classes)
    chemin_poids = trouver_fichier(
        ["agricam_best_weights.h5", "*best_weights.h5"], "poids"
    )

    print(f"\n{len(classes)} classes.\n")
    modele = construire(len(classes))
    charger_poids(modele, chemin_poids)
    controler(modele)

    echantillon = echantillonner(dossier, classes)
    chemins = [c for c, _ in echantillon]
    verite = np.array([e for _, e in echantillon])
    print(f"\n{len(chemins)} images tirees au hasard.\n")

    # Chaque voie de chargement est evaluee avec et sans division par 255.
    voies = {
        "PIL nearest  (load_img par defaut)": lambda: charger_pil(chemins, "nearest"),
        "PIL bilinear": lambda: charger_pil(chemins, "bilinear"),
        "TF  bilinear (comme l'entrainement)": lambda: charger_tf(chemins, False),
        "TF  bilinear + anticrenelage": lambda: charger_tf(chemins, True),
    }

    # La division par 255 a deja ete ecartee : elle donnait 11,1 %, soit le
    # hasard pour neuf classes. Aucun Rescaling n'est donc actif en inference,
    # et le reseau attend bien des pixels bruts. On ne teste plus que la
    # methode de redimensionnement.
    print("=" * 66)
    print(f" {'Chargement (pixels bruts [0,255])':<48}{'exactitude':>16}")
    print("=" * 66)

    resultats = {}
    for libelle, charger in voies.items():
        lot = charger()
        probabilites = modele.predict(lot, verbose=0, batch_size=16)
        exactitude = float((probabilites.argmax(axis=1) == verite).mean())
        resultats[libelle] = (exactitude, probabilites)
        print(f" {libelle:<48}{exactitude:>15.1%}")

    print("=" * 66)

    voie, (exactitude, probabilites) = max(resultats.items(), key=lambda kv: kv[1][0])

    print(f"\nMEILLEURE VOIE : {voie}")
    print(f"Exactitude : {exactitude:.1%}   Confiance moyenne : {probabilites.max(axis=1).mean():.1%}")

    print("\nDetail par classe :")
    predictions = probabilites.argmax(axis=1)
    for indice, nom in enumerate(classes):
        masque = verite == indice
        if masque.sum() == 0:
            continue
        score = float((predictions[masque] == indice).mean())
        print(f"  {nom:<30} {score:5.0%} {'#' * round(score * 24)}")

    print()
    if exactitude >= 0.90:
        print(
            f"CONCLUSION : le modele retrouve son niveau avec « {voie} ».\n"
            "             C'est cette voie qu'il faut reproduire dans\n"
            "             l'application - dites-le-moi, j'ajuste le code."
        )
    else:
        print(
            "CONCLUSION : aucune voie ne retrouve les 95,9 % annonces.\n"
            "             L'ecart ne vient donc pas du redimensionnement seul.\n"
            "             Envoyez-moi ce tableau et la cellule du notebook qui\n"
            "             construit le modele (celle avec data_augmentation)."
        )

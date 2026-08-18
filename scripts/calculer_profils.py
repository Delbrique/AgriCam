"""
================================================================================
 AgriCam - profils de classe, pour detecter les photos hors sujet
================================================================================

A executer dans l'environnement conda `agricam` (celui de l'entrainement) :

    conda activate agricam
    python scripts\\calculer_profils.py

--------------------------------------------------------------------------------
 POURQUOI
--------------------------------------------------------------------------------
Le classifieur est un classifieur "ensemble ferme" : il repartit toujours ce
qu'on lui montre entre les 9 classes connues, meme une photo totalement hors
sujet (un humain, un terrain de foot...), parfois avec une confiance elevee -
c'est un defaut documente des reseaux entraines par softmax, pas une anomalie
de ce modele precis.

Ce script calcule, pour chacune des 9 classes, un PROFIL : le vecteur de
caracteristiques moyen (le meme vecteur 1536-d que la moyenne spatiale
utilisee par la couche de decision, voir classifieur.ts / exporter_modeles.py)
des images d'entrainement de cette classe, ainsi qu'un seuil de similarite en
deca duquel une image ne ressemble a aucune classe connue.

--------------------------------------------------------------------------------
 METHODE (version corrigee)
--------------------------------------------------------------------------------
La premiere version calibrait le seuil sur le 1er centile de la similarite des
MEMES images que celles ayant servi a construire le profil - un seuil bien
trop permissif (fuite methodologique), qui n'a pas rejete une photo de terrain
de foot en pratique.

Cette version separe, par classe, un lot IMAGES_PROFIL (sert au profil) d'un
lot IMAGES_VALIDATION (jamais vu par le profil, sert uniquement a mesurer le
taux de vrais positifs conserves a un seuil donne). Elle evalue en plus un
petit lot d'images GENUINEMENT hors sujet (vraies photos personnelles, sans
rapport avec les cultures - voir DOSSIERS_HORS_SUJET) pour mesurer le taux de
rejet reel, plutot que de deviner un centile a l'aveugle.

Le script affiche, pour plusieurs seuils candidats, le compromis mesure
(rappel sur images connues vs taux de rejet sur images hors sujet), et choisit
automatiquement le seuil le plus strict qui garde au moins RAPPEL_MIN de
rappel sur les images de validation connues.
================================================================================
"""

from __future__ import annotations

import json
import pathlib
import random
import sys

import numpy as np
from PIL import Image
from tensorflow import keras

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from chargement_poids import charger_poids, controler  # noqa: E402

ICI = pathlib.Path(__file__).resolve().parent.parent  # dossier agricam/
RACINE_SOUTENANCE = ICI.parent
COTE = 224

IMAGES_MAX_PAR_CLASSE = 450  # plafond par classe, pour un temps de calcul raisonnable.
FRACTION_VALIDATION = 0.2   # part tenue a l'ecart du centroide, meme sur les petites classes.
RAPPEL_MIN = 0.95           # on choisit le seuil le plus strict qui garde au moins ce rappel.

CHEMIN_MODELE = ICI / "modeles" / "agricam_best_weights.h5"
CHEMIN_CLASSES = RACINE_SOUTENANCE / "class_names.json"
DOSSIER_DONNEES = RACINE_SOUTENANCE / "data" / "agricam"
SORTIE = ICI / "public" / "models" / "profils.json"

# Vraies photos personnelles, sans aucun rapport avec les cultures - servent a
# mesurer le taux de rejet reel plutot que de deviner un seuil a l'aveugle.
# Jamais transmises nulle part : lues localement, uniquement pour calibrer.
DOSSIERS_HORS_SUJET = [
    pathlib.Path(r"C:\Users\F3LX_STORE\Pictures\Iphone"),
    pathlib.Path(r"C:\Windows\Web\Screen"),
]
MAX_HORS_SUJET = 60


def charger_classes() -> list[str]:
    classes = json.loads(CHEMIN_CLASSES.read_text(encoding="utf-8"))
    if isinstance(classes, dict):
        classes = [classes[c] for c in sorted(classes, key=int)]
    return classes


def charger_modele(classes: list[str]):
    try:
        modele = keras.models.load_model(CHEMIN_MODELE, compile=False)
        print(f"Modele complet recharge ({len(modele.layers)} couches).")
        return modele
    except Exception as erreur:
        print(f"Pas un modele complet ({erreur}). Reconstruction de l'architecture.")

    base = keras.applications.EfficientNetB3(
        include_top=False, weights="imagenet", input_shape=(COTE, COTE, 3)
    )
    entree = keras.Input(shape=(COTE, COTE, 3))
    x = base(entree, training=False)
    x = keras.layers.GlobalAveragePooling2D(name="avg_pool")(x)
    x = keras.layers.Dropout(0.3, name="top_dropout")(x)
    sortie = keras.layers.Dense(len(classes), activation="softmax", name="predictions")(x)
    modele = keras.Model(entree, sortie, name="AgriCam")

    charger_poids(modele, CHEMIN_MODELE)
    controler(modele)
    return modele


def isoler_tronc(modele):
    for couche in modele.layers:
        if isinstance(couche, keras.Model) and "efficientnet" in couche.name.lower():
            return keras.Model(couche.input, couche.output, name="tronc")
    for i, couche in enumerate(modele.layers):
        if isinstance(couche, keras.layers.GlobalAveragePooling2D):
            return keras.Model(modele.input, modele.layers[i - 1].output, name="tronc")
    raise SystemExit("Impossible d'isoler le tronc convolutif.")


def charger_image(chemin: pathlib.Path) -> np.ndarray | None:
    try:
        image = Image.open(chemin).convert("RGB").resize((COTE, COTE))
        return np.asarray(image, dtype=np.float32)  # 0-255 : EfficientNet normalise en interne.
    except Exception:
        return None  # fichier illisible/corrompu - ignore plutot que de tout arreter.


def embeddings(tronc, fichiers: list[pathlib.Path], taille_lot: int = 32) -> np.ndarray:
    tous_les_vecteurs = []
    for depart in range(0, len(fichiers), taille_lot):
        lot_fichiers = fichiers[depart : depart + taille_lot]
        images = [charger_image(f) for f in lot_fichiers]
        images = [im for im in images if im is not None]
        if not images:
            continue
        lot = np.stack(images)
        activations = tronc.predict(lot, verbose=0)  # (n, 7, 7, 1536)
        vecteurs = activations.mean(axis=(1, 2))  # (n, 1536)
        tous_les_vecteurs.append(vecteurs)
        print(f"    {min(depart + taille_lot, len(fichiers))}/{len(fichiers)}", end="\r")
    print()
    return np.concatenate(tous_les_vecteurs, axis=0)


def normaliser(vecteurs: np.ndarray) -> np.ndarray:
    normes = np.linalg.norm(vecteurs, axis=-1, keepdims=True)
    return vecteurs / np.maximum(normes, 1e-9)


def lister_images(dossier: pathlib.Path, limite: int, graine: int = 0) -> list[pathlib.Path]:
    fichiers = [
        f for f in sorted(dossier.rglob("*"))
        if f.suffix.lower() in (".jpg", ".jpeg", ".png") and f.is_file()
    ]
    random.Random(graine).shuffle(fichiers)
    return fichiers[:limite]


def main():
    classes = charger_classes()
    print(f"{len(classes)} classes.")

    modele = charger_modele(classes)
    tronc = isoler_tronc(modele)
    print(f"Tronc isole : sortie {tronc.output_shape}")

    # --- 1. Centroides + jeu de validation "connu", jamais vu par le centroide ---
    centroides = []
    validation_par_classe = []  # (nom_classe, vecteurs_normes_validation)
    for nom_classe in classes:
        dossier = DOSSIER_DONNEES / nom_classe
        fichiers = lister_images(dossier, IMAGES_MAX_PAR_CLASSE)
        coupure = max(1, int(len(fichiers) * (1 - FRACTION_VALIDATION)))
        fichiers_profil = fichiers[:coupure]
        fichiers_validation = fichiers[coupure:]

        print(f"\n{nom_classe} : {len(fichiers_profil)} images profil, {len(fichiers_validation)} images validation")
        vecteurs_profil = normaliser(embeddings(tronc, fichiers_profil))
        centroide = vecteurs_profil.mean(axis=0)
        centroide = centroide / np.maximum(np.linalg.norm(centroide), 1e-9)
        centroides.append(centroide)

        if fichiers_validation:
            vecteurs_validation = normaliser(embeddings(tronc, fichiers_validation))
        else:
            vecteurs_validation = vecteurs_profil  # classe trop petite : repli sur le meme lot.
        validation_par_classe.append((nom_classe, vecteurs_validation))

    centroides = np.stack(centroides)  # (9, 1536)

    # --- 2. Images reellement hors sujet, pour mesurer le taux de rejet reel ---
    fichiers_hors_sujet: list[pathlib.Path] = []
    for dossier in DOSSIERS_HORS_SUJET:
        if dossier.exists():
            fichiers_hors_sujet += lister_images(dossier, MAX_HORS_SUJET // len(DOSSIERS_HORS_SUJET))
    print(f"\n{len(fichiers_hors_sujet)} images hors sujet (validation du rejet) :")
    vecteurs_hors_sujet = normaliser(embeddings(tronc, fichiers_hors_sujet)) if fichiers_hors_sujet else None

    # --- 3. Similarite de chaque image de validation a SA propre classe -------
    similarites_connues = []
    for i, (nom_classe, vecteurs) in enumerate(validation_par_classe):
        sim = vecteurs @ centroides[i]
        similarites_connues.append(sim)
    similarites_connues = np.concatenate(similarites_connues)

    # Similarite de chaque image hors sujet a la MEILLEURE classe (le plus
    # favorable possible pour elle - si meme le meilleur score est bas, une
    # vraie inference la rejetterait tout autant).
    if vecteurs_hors_sujet is not None:
        similarites_hors_sujet = (vecteurs_hors_sujet @ centroides.T).max(axis=1)
    else:
        similarites_hors_sujet = np.array([])

    # --- 4. Table de compromis, pour choisir le seuil en connaissance de cause ---
    print("\nSeuil   | rappel images connues | rejet images hors sujet")
    candidats = np.unique(np.concatenate([
        np.percentile(similarites_connues, np.arange(0, 101, 2)),
    ]))
    meilleur_seuil = float(candidats.min())
    for seuil in sorted(candidats):
        rappel = float((similarites_connues >= seuil).mean())
        rejet = float((similarites_hors_sujet < seuil).mean()) if len(similarites_hors_sujet) else float("nan")
        marque = ""
        if rappel >= RAPPEL_MIN:
            meilleur_seuil = float(seuil)  # le plus strict qui respecte encore RAPPEL_MIN
            marque = "  <-- candidat retenu"
        print(f"{seuil:.3f}   | {rappel * 100:5.1f} %                | {rejet * 100:5.1f} %{marque}")

    print(f"\nSeuil global retenu : {meilleur_seuil:.3f} (rappel >= {RAPPEL_MIN * 100:.0f} % sur images connues)")

    # --- 5. Ecriture, un seuil par classe pour ne pas defavoriser les classes
    #        naturellement plus diverses (celles-ci auraient un seuil global
    #        trop dur), mais jamais en-dessous du seuil global retenu. -------
    profils = []
    for i, (nom_classe, vecteurs) in enumerate(validation_par_classe):
        sim_classe = vecteurs @ centroides[i]
        seuil_classe = max(meilleur_seuil, float(np.percentile(sim_classe, 100 * (1 - RAPPEL_MIN))))
        profils.append(
            {
                "classe": nom_classe,
                "centroide": centroides[i].astype(np.float32).tolist(),
                "seuil": seuil_classe,
            }
        )
        print(f"  {nom_classe:32s} seuil final {seuil_classe:.3f}")

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(
        json.dumps({"canaux": int(len(profils[0]["centroide"])), "profils": profils}),
        encoding="utf-8",
    )
    print(f"\nEcrit : {SORTIE} ({SORTIE.stat().st_size / 1024:.0f} Ko)")


if __name__ == "__main__":
    main()

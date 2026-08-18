"""
================================================================================
 AgriCam - export des modeles entraines vers le navigateur
================================================================================

A executer dans l'environnement conda `agricam` (Python 3.10, TensorFlow 2.10),
celui de l'entrainement, et DEPUIS le dossier Soutenance :

    conda activate agricam
    pip install tensorflowjs==3.18.0 onnx onnxsim ultralytics
    python exporter_modeles.py

Le script cherche les fichiers tout seul. Il n'ecrase rien : il ecrit dans un
dossier `public/models/` cree a cote.

Produit :
    public/models/tronc/model.json + *.bin   EfficientNetB3 tronque, TF.js
    public/models/tete.json                  poids de la couche Dense finale
    public/models/classes.json               ordre exact des classes
    public/models/detecteur.onnx             YOLOv8n pour onnxruntime-web

--------------------------------------------------------------------------------
 POURQUOI COUPER LE MODELE EN DEUX ?
--------------------------------------------------------------------------------
TensorFlow.js ne calcule pas de gradients sur un GraphModel converti : Grad-CAM
y est donc impossible tel quel. Mais l'architecture se termine par
GlobalAveragePooling -> Dense(softmax), et dans ce cas precis les coefficients
de Grad-CAM se reduisent aux poids de la couche dense :

    alpha_k^c = w_kc / Z      donc      L_c = ReLU( somme_k [ w_kc * A_k ] )

C'est le CAM de Zhou et al. (2016), mathematiquement identique a Grad-CAM pour
cette architecture, et calculable sans aucun gradient. On exporte donc le seul
tronc convolutif ; la moyenne spatiale, la couche dense et le softmax sont
reimplementes en JavaScript.
================================================================================
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys

import numpy as np
from tensorflow import keras

ICI = pathlib.Path.cwd()
SORTIE = ICI / "public" / "models"
COTE = 224


# ==============================================================================
#  1. Reperage automatique des fichiers
# ==============================================================================

# Racines explorees, dans l'ordre : le dossier courant, celui du script, et
# leurs parents. Ainsi le script fonctionne qu'on le lance depuis `agricam`,
# depuis `agricam/scripts`, ou depuis `Soutenance`.
def racines():
    vues, sortie = set(), []
    for depart in (pathlib.Path.cwd(), pathlib.Path(__file__).resolve().parent):
        for candidat in (depart, depart.parent, depart.parent.parent):
            if candidat.exists() and candidat not in vues:
                vues.add(candidat)
                sortie.append(candidat)
    return sortie


RACINES = racines()


def trouver(motifs, description, obligatoire=True, dossier=False):
    """Cherche le premier fichier correspondant, sous l'une des racines."""
    for racine in RACINES:
        for motif in motifs:
            trouves = sorted(racine.glob(motif)) + sorted(racine.glob(f"**/{motif}"))
            trouves = [t for t in trouves if "node_modules" not in t.parts]
            trouves = [t for t in trouves if t.is_dir() == dossier]
            if trouves:
                print(f"  [ok] {description:<28} {trouves[0]}")
                return trouves[0]
    if obligatoire:
        raise SystemExit(
            f"\n[MANQUANT] {description}\n"
            f"           Motifs cherches : {', '.join(motifs)}\n"
            f"           Racines explorees :\n"
            + "".join(f"             - {r}\n" for r in RACINES)
        )
    print(f"  [--] {description:<28} introuvable")
    return None


print("Recherche des fichiers dans :")
for _r in RACINES:
    print(f"   {_r}")
print()

# ORDRE IMPORTANT : agricam_best_weights.h5 d'abord.
# agricam_fruits_model.h5 existe mais fait 0 octet - une sauvegarde qui a
# echoue en silence. Le charger donnait un reseau reste initialise au hasard,
# sans qu'aucune erreur ne soit levee.
CHEMIN_MODELE = trouver(
    ["agricam_best_weights.h5", "*best_weights.h5", "agricam_fruits_model.h5"],
    "poids du classifieur",
)
if CHEMIN_MODELE.stat().st_size < 1024 * 1024:
    raise SystemExit(
        f"\n[FICHIER VIDE] {CHEMIN_MODELE} ne pese que "
        f"{CHEMIN_MODELE.stat().st_size} octets.\n"
        "               Les poids attendus font une quarantaine de Mo."
    )
CHEMIN_CLASSES = trouver(["class_names.json"], "noms des classes")
CHEMIN_YOLO = trouver(
    [
        "runs_agricam/*/weights/best.pt",
        "runs/**/weights/best.pt",
        "**/weights/best.pt",
        "agricam_yolo_tomate.pt",
        "best.pt",
    ],
    "detecteur YOLO entraine",
    obligatoire=False,
)


# ==============================================================================
#  2. Chargement du classifieur
# ==============================================================================

def charger_modele(classes):
    """
    Deux cas selon la maniere dont le modele a ete sauvegarde.

    Si le fichier contient un modele complet (`model.save`), on le recharge tel
    quel : voie la plus sure, aucune architecture a reconstruire. S'il ne
    contient que des poids (`save_weights`), il faut rebatir la structure.
    """
    try:
        modele = keras.models.load_model(CHEMIN_MODELE, compile=False)
        print(f"\nModele complet recharge ({len(modele.layers)} couches).")
        return modele
    except Exception as erreur:
        print(f"\nPas un modele complet ({erreur}).")
        print("Reconstruction de l'architecture, puis injection des poids.")

    # L'architecture d'entrainement comportait aussi une couche
    # `data_augmentation`. Elle ne porte aucun poids et reste inactive en
    # inference : on peut l'omettre sans consequence, et c'est meme preferable
    # pour l'export. Les noms `efficientnetb3` et `predictions` suffisent a
    # l'appariement.
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
    sortie = keras.layers.Dense(len(classes), activation="softmax", name="predictions")(x)
    modele = keras.Model(entree, sortie, name="AgriCam")

    # Chargement deterministe, par nom de tenseur.
    # `load_weights` echoue ici sur un modele imbrique - EfficientNetB3 est une
    # couche unique portant 497 tenseurs - avec un message opaque
    # (`axes don't match array`). Le module chargement_poids lit le fichier
    # HDF5 directement et rend compte de chaque appariement.
    from chargement_poids import charger_poids, controler

    charger_poids(modele, CHEMIN_MODELE)
    controler(modele)

    return modele


def isoler_tronc(modele):
    """
    Recupere la partie convolutive.

    Avec `include_top=False`, la sortie du reseau de base EST deja celle de la
    derniere couche convolutive (top_activation), soit 7 x 7 x 1536 - exactement
    ce dont la carte d'activation a besoin.
    """
    for couche in modele.layers:
        if isinstance(couche, keras.Model) and "efficientnet" in couche.name.lower():
            return keras.Model(couche.input, couche.output, name="tronc")

    # Modele a plat : on coupe juste avant la moyenne spatiale.
    for i, couche in enumerate(modele.layers):
        if isinstance(couche, keras.layers.GlobalAveragePooling2D):
            return keras.Model(modele.input, modele.layers[i - 1].output, name="tronc")

    raise SystemExit(
        "Impossible d'isoler le tronc convolutif.\n"
        "Executez `modele.summary()` et envoyez-moi la sortie."
    )


def couche_decision(modele):
    for couche in reversed(modele.layers):
        if isinstance(couche, keras.layers.Dense):
            return couche
    raise SystemExit("Aucune couche Dense trouvee dans le modele.")


# ==============================================================================
#  3. Exports
# ==============================================================================

def exporter_classifieur(modele, classes):
    tronc = isoler_tronc(modele)
    print(f"Tronc isole : sortie {tronc.output_shape}")

    # Sans cette conversion, la sauvegarde echoue sur la couche de mise a
    # l'echelle d'EfficientNet, dont le coefficient est un EagerTensor
    # inserialisable en JSON. Voir rendre_serialisable.
    from chargement_poids import rendre_serialisable
    rendre_serialisable(tronc)

    temporaire = ICI / "_tronc_savedmodel"
    if temporaire.exists():
        shutil.rmtree(temporaire)
    tronc.save(temporaire, save_format="tf")

    cible = SORTIE / "tronc"
    if cible.exists():
        shutil.rmtree(cible)
    cible.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            sys.executable, "-m", "tensorflowjs.converters.converter",
            "--input_format=tf_saved_model",
            "--output_format=tfjs_graph_model",
            "--signature_name=serving_default",
            "--saved_model_tags=serve",
            "--quantize_uint8=*",          # divise le poids par environ quatre
            str(temporaire), str(cible),
        ],
        check=True,
    )
    shutil.rmtree(temporaire)

    dense = couche_decision(modele)
    poids, biais = dense.get_weights()     # (canaux, nb_classes) et (nb_classes,)

    (SORTIE / "tete.json").write_text(
        json.dumps({
            "poids": np.asarray(poids, dtype=np.float32).ravel().tolist(),
            "biais": np.asarray(biais, dtype=np.float32).tolist(),
            "canaux": int(poids.shape[0]),
            "classes": int(poids.shape[1]),
        }),
        encoding="utf-8",
    )
    (SORTIE / "classes.json").write_text(
        json.dumps(classes, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Tete exportee : {poids.shape[0]} canaux -> {poids.shape[1]} classes.")


def exporter_detecteur():
    if CHEMIN_YOLO is None:
        print(
            "\n[!] DETECTEUR NON EXPORTE\n"
            "    Le fichier best.pt de l'entrainement YOLO est introuvable.\n"
            "    Il se trouve normalement dans runs_agricam/<nom>/weights/.\n"
            "\n"
            "    ATTENTION : yolov8n.pt et yolo26n.pt sont les poids COCO\n"
            "    d'origine. Ils detectent des personnes et des voitures, pas\n"
            "    vos fruits. Ne les utilisez pas comme substitut.\n"
            "\n"
            "    Sans best.pt, l'application bascule en diagnostic pleine\n"
            "    image : le multi-fruits et le taux d'infestation sont perdus."
        )
        return

    from ultralytics import YOLO

    yolo = YOLO(str(CHEMIN_YOLO))
    print(f"\nDetecteur charge. Classes du detecteur : {yolo.names}")
    chemin = yolo.export(format="onnx", imgsz=640, opset=12, simplify=True)
    shutil.copy(chemin, SORTIE / "detecteur.onnx")
    print("Detecteur exporte : detecteur.onnx")


# ==============================================================================
#  4. Verification - le controle qui evite la panne muette
# ==============================================================================

def verifier(modele):
    """
    Compare la prediction de Keras a celle que reproduira le JavaScript.

    Sans ce controle, un poids transpose ou une normalisation appliquee deux
    fois donnerait un modele qui se charge sans erreur mais diagnostique de
    travers - la panne la plus couteuse, parce qu'elle ne dit rien.
    """
    tronc = isoler_tronc(modele)
    dense = couche_decision(modele)
    poids, biais = dense.get_weights()

    # Pixels bruts sur 0-255 : EfficientNet normalise en interne. Diviser par
    # 255 ici reviendrait a normaliser deux fois.
    echantillon = np.random.uniform(0, 255, (1, COTE, COTE, 3)).astype("float32")

    reference = modele.predict(echantillon, verbose=0)[0]

    activations = tronc.predict(echantillon, verbose=0)[0]   # (7, 7, 1536)
    scores = activations.mean(axis=(0, 1)) @ poids + biais
    scores = np.exp(scores - scores.max())
    reconstruit = scores / scores.sum()

    ecart = float(np.abs(reference - reconstruit).max())
    print(f"\nEcart maximal Keras / reconstruction manuelle : {ecart:.2e}")
    if ecart > 1e-4:
        raise SystemExit(
            "ECART ANORMAL. N'allez pas plus loin : la tete JavaScript ne "
            "reproduirait pas Keras. Envoyez-moi cette valeur."
        )
    print("Verification reussie - le JavaScript reproduira fidelement Keras.")


# ==============================================================================

if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)

    classes = json.loads(CHEMIN_CLASSES.read_text(encoding="utf-8"))
    if isinstance(classes, dict):                     # {"0": "...", "1": "..."}
        classes = [classes[c] for c in sorted(classes, key=int)]

    print(f"\n{len(classes)} classes, dans cet ordre :")
    for i, nom in enumerate(classes):
        print(f"   {i} : {nom}")

    modele = charger_modele(classes)
    exporter_classifieur(modele, classes)
    print(
        "\n[i] Le detecteur s'exporte a part, dans l'environnement `yolo` :\n"
        "    conda activate yolo\n"
        "    python scripts\\exporter_detecteur.py\n"
        "    (TensorFlow et PyTorch ne peuvent cohabiter dans le meme\n"
        "     environnement : leurs bibliotheques CUDA sont incompatibles.)"
    )
    verifier(modele)

    print("\nContenu de public/models/ :")
    total = 0
    for f in sorted(SORTIE.rglob("*")):
        if f.is_file():
            total += f.stat().st_size
            print(f"   {f.relative_to(SORTIE)}  ({f.stat().st_size / 1024:.0f} Ko)")
    print(f"\nPoids total a telecharger par le producteur : {total / 1024 ** 2:.1f} Mo")

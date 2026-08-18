# AgriCam

**Diagnostic phytosanitaire explicable des cultures maraîchères — tomate, piment, oignon — à partir d'une simple photo, entièrement hors ligne.**

Projet de fin de cycle (Bachelor IA & Big Data). Pensé pour le petit producteur camerounais, sans encadrement technique systématique, avec un téléphone d'entrée de gamme et une connexion intermittente — pas pour une exploitation équipée en drones et capteurs.

---

## Ce que fait l'application

1. **Le producteur photographie un fruit.** Aucune image ne quitte le téléphone.
2. **Un détecteur (YOLOv8n) repère chaque fruit dans la scène** et le recadre — le classifieur n'a jamais à deviner où regarder dans une photo de terrain (branche, feuillage, sol).
3. **Un classifieur (EfficientNetB3) diagnostique chaque fruit** parmi 9 états sanitaires, sur les 3 cultures.
4. **Une carte d'activation (CAM) montre la zone qui a motivé la décision** — calculée sans le moindre gradient (voir [Le pari technique](#le-pari-technique-explicabilité-sans-gradients)).
5. **Sous le seuil de confiance, l'application refuse de trancher** plutôt que d'afficher un diagnostic peu fiable.
6. **Une image qui ne ressemble à aucune des 9 classes connues est signalée comme hors sujet**, plutôt que d'être forcée dans la classe la plus proche (voir [Détection hors sujet](#détection-hors-sujet)).
7. **La conduite à tenir s'affiche immédiatement** (gestes, urgence, ce qu'il ne faut *pas* faire) — disponible hors ligne. En ligne, un conseil plus détaillé est généré (Groq) et exportable en PDF.
8. **Chaque diagnostic géolocalisé devient un point sur une carte personnelle du champ**, pour repérer où se trouvent les foyers au fil des visites.
9. **Tout reste sur le téléphone** : historique, corrections, position — rien n'est transmis à un serveur, sauf les trois fonctionnalités explicitement en ligne (conseil détaillé, astuce du jour, assistant), qui n'envoient jamais de photo.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Le pari technique : explicabilité sans gradients](#le-pari-technique-explicabilité-sans-gradients)
- [Détection hors sujet](#détection-hors-sujet)
- [Pile technique](#pile-technique)
- [Démarrage](#démarrage)
- [Export des modèles](#export-des-modèles)
- [Organisation du code](#organisation-du-code)
- [Déploiement](#déploiement)
- [Performance du modèle](#performance-du-modèle)
- [Limites connues](#limites-connues)
- [Documentation](#documentation)

## Fonctionnalités

| Domaine | Détail |
|---|---|
| **Diagnostic** | Détection multi-fruits, taux d'infestation, carte de chaleur, seuil de confiance, détection hors sujet, correction manuelle du producteur |
| **Conduite à tenir** | Fiche par maladie (urgence, gestes, à éviter, prévention), disponible **hors ligne** |
| **Conseil détaillé** | Généré par Groq (llama-3.3-70b) en ligne, mis en forme, exportable en **PDF** (Times New Roman, justifié, mise en page soignée) |
| **Historique** | Liste des consultations, statistiques, détail par photo, suppression |
| **Carte des foyers** | Carte personnelle (Leaflet + OpenStreetMap) des diagnostics géolocalisés, position actuelle avec géocodage inverse, filtre par culture |
| **Sensibilisation** | Astuce du jour générée par Groq sur une maladie aléatoire parmi les 3 cultures, avec repli local hors ligne |
| **Assistant** | Icône flottante déplaçable, chatbot cantonné au périmètre de l'app (diagnostics, recommandations, usage), avec upload d'images (modèle Groq vision) et de documents PDF/DOCX/texte |
| **Hors ligne** | PWA installable, service worker avec précache des modèles (~35 Mo), repli de navigation hors ligne |
| **i18n** | Français / anglais |
| **Accessibilité** | Cibles tactiles ≥ 48 px, focus clavier visible, `prefers-reduced-motion` respecté, thème clair/sombre |

## Le pari technique : explicabilité sans gradients

TensorFlow.js ne calcule pas de gradients sur un modèle converti (`GraphModel`) : Grad-CAM y est donc hors d'atteinte tel quel. L'architecture du classifieur se termine par `GlobalAveragePooling → Dense(softmax)` ; dans ce cas précis, les coefficients de Grad-CAM se réduisent aux poids de la couche dense — c'est le CAM original de Zhou et al. (2016), mathématiquement identique à Grad-CAM pour cette architecture, et calculable **sans aucun gradient**.

Le modèle est donc exporté en deux morceaux :

- le **tronc convolutif** (EfficientNetB3 tronqué) → TensorFlow.js `GraphModel`, quantifié ;
- la **couche de décision** (poids + biais de la couche Dense finale) → un simple JSON.

La moyenne spatiale, la couche dense et le softmax sont réimplémentés en JavaScript pur (`src/lib/classifieur.ts`), ce qui livre la prédiction **et** la carte d'activation en un seul passage.

## Détection hors sujet

Un classifieur softmax est un « ensemble fermé » : il répartit toujours ce qu'on lui montre entre ses classes connues, même une photo totalement hors sujet — parfois avec une confiance élevée. `scripts/calculer_profils.py` calcule, pour chacune des 9 classes, un **profil** (le vecteur de caractéristiques moyen des images d'entraînement, avant la couche de décision) et un **seuil de similarité**, calibré par validation croisée sur un jeu d'images tenues à l'écart du profil, et testé contre de vraies photos hors sujet — pas une valeur choisie au hasard.

À l'inférence, l'image reçue est comparée au profil de la classe retenue par le classifieur ; en dessous du seuil, l'application répond honnêtement **« Photo hors sujet »** plutôt que d'imposer un diagnostic.

## Pile technique

**Client** — React 18 · TypeScript · Vite · Tailwind CSS · React Router
**Inférence dans le navigateur** — TensorFlow.js (classifieur) · onnxruntime-web (détecteur YOLOv8n, WASM SIMD embarqué pour l'usage hors ligne)
**Carte** — Leaflet + tuiles OpenStreetMap, géocodage inverse Nominatim
**Stockage** — IndexedDB (historique, corrections), local à l'appareil
**PWA** — vite-plugin-pwa (Workbox), manifeste installable
**Backend** — 3 fonctions serverless Vercel, simples relais vers l'API Groq (la clé ne quitte jamais le serveur) : conseil détaillé, astuce du jour, assistant
**Documents (assistant)** — pdfjs-dist (PDF), mammoth (DOCX), chargés à la demande
**Export PDF** — jsPDF
**Entraînement / export des modèles** — Python, TensorFlow/Keras 2.10, Ultralytics YOLOv8, scripts dédiés (voir `scripts/`)

## Démarrage

```bash
npm install
npm run dev          # http://localhost:5173
```

L'application démarre sans les modèles : tout diagnostic échouera tant que `public/models/` n'a pas été rempli (voir ci-dessous). Pour le conseil détaillé, l'astuce du jour et l'assistant, une clé Groq est nécessaire :

```bash
# .env (jamais commité)
GROQ_API_KEY=...
```

## Export des modèles

Les poids entraînés (`agricam_best_weights.h5`, `agricam_yolo_tomate.pt`) et `class_names.json` sont volontairement **hors dépôt** (`.gitignore`) : trop lourds pour git, et régénérables. Deux environnements conda distincts sont nécessaires — TensorFlow et PyTorch/Ultralytics ne cohabitent pas dans le même environnement (bibliothèques CUDA incompatibles).

```bash
# Classifieur — environnement `agricam` (TensorFlow 2.10)
conda activate agricam
pip install tensorflowjs==3.18.0 onnx onnxsim ultralytics
python scripts/exporter_modeles.py

# Détecteur — environnement `yolo` (Ultralytics)
conda activate yolo
python scripts/exporter_detecteur.py

# Profils de classe (détection hors sujet), a executer apres l'export du classifieur
conda activate agricam
python scripts/calculer_profils.py
```

`exporter_modeles.py` se termine par un contrôle : il compare la prédiction Keras à la prédiction reconstruite à la main en JavaScript. Un écart supérieur à `1e-4` fait échouer l'export — le garde-fou contre un modèle qui se charge sans erreur mais prédit de travers.

**Le piège à connaître : aucune division par 255.** EfficientNet embarque sa propre couche de normalisation. Fournir des pixels dans `[0, 1]` revient à normaliser deux fois : la précision s'effondre, *sans lever la moindre erreur*. Les pixels sont transmis bruts, sur `[0, 255]`, aussi bien en Python qu'en JavaScript.

## Organisation du code

```
api/                     fonctions serverless Vercel (relais Groq)
  conseil.ts             conseil de traitement détaillé
  astuce.ts              astuce du jour
  assistant.ts           chatbot

scripts/                 pipeline modèle (Python + Node), hors build web
  exporter_modeles.py    classifieur -> TF.js + tête JS
  exporter_detecteur.py  détecteur YOLO -> ONNX
  calculer_profils.py    profils de classe pour la détection hors sujet
  chargement_poids.py    chargement déterministe des poids HDF5
  copier-ort.mjs         copie le runtime WASM onnxruntime (postinstall)

src/
  lib/                    logique métier, sans dépendance à React
    classes.ts            référentiel des 9 classes et échelle de gravité
    qualite.ts             contrôle flou / exposition avant inférence
    detecteur.ts           YOLOv8n via onnxruntime-web
    classifieur.ts         tronc TF.js + tête JS + carte d'activation + hors sujet
    pipeline.ts            enchaînement complet et agrégation multi-fruits
    stockage.ts            IndexedDB : historique, corrections, parcelles
    assistant.ts, astuce.ts, documents.ts    clients des fonctions Groq

  components/             interface
    BandeSeverite         élément signature — probabilités par maladie, en barres
    PhotoAnnotee          photo + boîtes du détecteur
    FicheResultat         verdict, explicabilité, conduite à tenir, correction
    VueCapture            prise de vue, tendance locale, astuce du jour
    CarteFoyers           carte des foyers géolocalisés
    Assistant              icône flottante déplaçable + chat

  pages/                  Accueil, Diagnostic, Historique, Carte
  data/                   conduites à tenir et astuces, écrites en dur (repli hors ligne)
```

## Déploiement

Hébergé sur Vercel. `vercel.json` ajoute la règle de réécriture nécessaire au routage côté client (sans elle, toute navigation directe vers `/diagnostic` ou `/historique` renvoie une 404).

```bash
vercel deploy          # preview
vercel deploy --prod   # production
```

Variable d'environnement requise sur Vercel : `GROQ_API_KEY` (Preview **et** Production).

## Performance du modèle

| Indicateur | Mesure |
|---|---|
| Exactitude du classifieur (jeu de test) | 95,6 % |
| Temps d'un diagnostic complet (navigateur) | ≈ 0,65 s |
| Poids total à télécharger | ≈ 35 Mo |
| mAP50 du détecteur (tomate) | 0,72 |

Détail complet (précision/rappel par classe, matrices de confusion, méthodologie) dans [`CAHIER_DES_CHARGES.md`](./CAHIER_DES_CHARGES.md).

## Limites connues

- **Oignon** : le bulbe n'est visible qu'une fois déterré — la carte des foyers et le diagnostic en conditions de terrain sont donc surtout pertinents pour la tomate et le piment.
- **Carte des foyers** : strictement personnelle et locale (IndexedDB de l'appareil). Pas de serveur partagé entre producteurs — cohérent avec le reste de l'application, mais pas d'alerte de voisinage à ce stade.
- **Installation iOS** : Safari isole le stockage d'une web app ajoutée à l'écran d'accueil de celui de l'onglet Safari classique. L'icône installée doit donc être ouverte une première fois **en ligne**, séparément, avant de fonctionner hors ligne — une contrainte de la plateforme, pas de l'application.
- **Détection hors sujet** : calibrée sur un échantillon de validation réduit ; efficace en pratique mais pas garantie à 100 %.

## Documentation

Le cahier des charges complet (contexte, objectifs, exigences, architecture détaillée, méthodologie d'évaluation) est disponible en [Markdown](./CAHIER_DES_CHARGES.md) et en [PDF](./AgriCam_cahier_des_charges.pdf).

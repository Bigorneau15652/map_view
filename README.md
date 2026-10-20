# map_view

English first, version française plus bas.

## English

A map widget for [Grist](https://www.getgrist.com): one pin per row, a label with a title and a description, pin colours, pin clustering, and a catalogue of base maps and overlay layers, including the free French public layers of the IGN (Géoplateforme). It started as a fork of the official Grist map widget and has since been rewritten.

### Features

- One pin per row, with the colour taken from a column (HEX code or colour name, in French or English), and a label (title and description) shown when the row is selected.
- Two-way selection: selecting a row moves the map to its pin, clicking a pin selects the row in Grist.
- A map catalogue opened from a button with a map icon: 21 reference layers of the IGN with a preview image, three open base maps (OpenStreetMap, CyclOSM, OpenTopoMap) and your own maps. A click shows the map at once on the map; the choice is saved with OK, and Cancel puts the previous map back.
- A base map and one overlay layer at the same time (for example aerial photographs and cadastral parcels), with a transparency slider at the bottom left of the map (it acts on the overlay, or on the base map when there is no overlay).
- An "Other..." button to add as many maps as you like (name, tile address, copyright, optional API key, base map or overlay). Each map can be edited with a pencil or deleted with a cross, and is kept in the widget options.
- In a small widget, the catalogue opens in its own window so that it can be read in full; in a large area it opens in place.
- The buttons and sliders fade after three seconds without movement over the map and come back at the next movement.
- A thin vertical zoom slider under the buttons at the top right (there are no + and - buttons).
- The map reopens where you left it (centre and zoom), and changing row keeps the zoom you chose. The view is kept in the browser of each user, not in the document, so that people do not change each other's view.
- A button at the top right opens the map in a separate window, for example on a second screen. The window follows the row selected in Grist, and clicking a pin there selects the row in Grist. Closing the window, or the "put the map back" button, brings the map back into Grist.
- Interface in French and English, chosen from the browser language.

### Install

1. Publish this repository with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The widget address is `https://YOUR-ACCOUNT.github.io/map_view/index.html`.
3. In Grist, add a page with a custom widget, paste that address and give it read access to the table ("Read table").
4. In the right-hand panel, under the access level, map the columns: Name, Longitude and Latitude (required), Description and Color (optional).
5. To link the map with a table or a card widget, set "Select by" in each widget so that they share the same selection.

If your Grist server is not `grist.numerique.gouv.fr`, edit two places in `index.html`: the `src` of the `grist-plugin-api.js` script and the host named in the Content-Security-Policy line above it (for the public service use `https://docs.getgrist.com`).

### Columns

| Column | Type | Required |
|---|---|:---:|
| Name | any | yes |
| Longitude | Numeric | yes |
| Latitude | Numeric | yes |
| Description | Text | no |
| Color | Text | no |

A row without coordinates (empty or 0 and 0) is skipped silently. A row whose coordinates are not numbers, or are outside the valid range, is left out and a banner above the map names the columns to check, the number of rows and a few examples. In the description, a line break or the two characters `\n` start a new line. Accepted colours: a HEX code such as `#FF0000`, or a name: `rouge`, `vert`, `bleu`, `bleu marine`, `bleu ciel`, `jaune`, `orange`, `violet`, `rose`, `gris`, `marron`, `turquoise`, `vert foncé`, `blanc`, `noir` and their English equivalents. The default colour is green.

### Maps and rights

No map is stored in this repository. The list of maps, the provider of each one and what is known about their terms are in [MAPS.md](MAPS.md). The 21 IGN layers come from the public Géoplateforme service and need no key (see `data/README.md`). The service holds hundreds of other layers, but many do not work in this widget, so they are left out: add one with "Other..." if you need it. TOPO 25 and the "Cartes IGN" layers are not part of that public service. Maps whose terms could not be confirmed (Esri and others) are not included: see "Not included" in [MAPS.md](MAPS.md).

### Adding a map with "Other..."

The tile address must start with `https://` and contain `{z}`, `{x}` and `{y}`. If the provider requires a key, put `{apikey}` where the key goes and type the key in the API key field: without it, the dialog shows "This map needs an API key". The key is stored in clear text in the widget options, so people with access to the document can read it: restrict the key to a domain at the provider.

### Security and privacy

- No external script except the Grist plugin API, loaded from your own Grist server. Leaflet and its clustering plugin are shipped in `vendor`, nothing is loaded from a CDN. A Content-Security-Policy limits scripts to this site and images to https.
- The data of the table is never sent anywhere. Each map provider sees the IP address of the users, the displayed area and the site that shows the map.
- Labels are built from text only: a description cannot load an image or run code. Tile addresses must be https; anything else is refused.
- Messages between the widget and the separate window are accepted only from the same site and only from the window the widget opened.
- Known trade-off: the separate window keeps its link to the widget (`window.opener`), because Grist runs widgets in a sandboxed frame that may only talk to windows it opened. Only map providers you trust should be added.

### Performance

The map is created once. Changing the base map, the overlay or the transparency only swaps tile layers. Editing a cell updates one pin. Thousands of pins are added in chunks and clustered. Settings are saved when a slider is released, not at every step.

### Releasing a change

Browsers keep GitHub Pages files for about ten minutes. Scripts and styles are referenced with `?v=0.4.4`: change that number in `index.html`, `window.html`, `catalog.html` and `js/window-link.js` with every release.

### Files

- `index.html`, `js/main-grist.js`: the widget (Grist connection, selection, separate window).
- `window.html`, `js/main-window.js`: the separate map window. `catalog.html`, `js/main-catalog.js`: the catalogue window. `js/config.js`: reading of the saved settings.
- `js/app.js`: the map screen shared by both. `js/engine.js`: the map and the pins. `js/menu.js`: catalogue, "Other" dialog, transparency slider. `js/catalog.js`: maps and layers. `js/records.js`: reading and checking the rows. `js/colors.js`: pin colours. `js/i18n.js`: French and English texts. `js/window-link.js`: link with the separate window.
- `data/ign-layers.js`: the IGN layers. `vendor`: Leaflet and Leaflet.markercluster.

Licence: MIT. Leaflet is under the BSD 2-Clause licence and Leaflet.markercluster under the MIT licence.

## Français

Widget carte pour [Grist](https://www.getgrist.com) : une épingle par ligne, une étiquette avec titre et description, couleurs d'épingles, regroupement des épingles et catalogue de fonds de carte et de couches superposées, dont les couches publiques gratuites de l'IGN (Géoplateforme). Il est parti d'un fork du widget carte officiel de Grist, puis a été réécrit.

### Fonctions

- Une épingle par ligne, dont la couleur vient d'une colonne (code HEX ou nom de couleur en français ou en anglais), et une étiquette (titre et description) affichée à la sélection de la ligne.
- Sélection dans les deux sens : sélectionner une ligne amène la carte sur son épingle, cliquer une épingle sélectionne la ligne dans Grist.
- Un catalogue de cartes ouvert par un bouton à pictogramme de carte : 21 couches de référence de l'IGN avec vignette, trois fonds libres (OpenStreetMap, CyclOSM, OpenTopoMap) et vos propres cartes. Un clic affiche aussitôt la carte ; le choix est enregistré avec OK, et Annuler remet la carte précédente.
- Un fond de carte et une couche superposée en même temps (par exemple photographies aériennes et parcelles cadastrales), avec une réglette de transparence en bas à gauche de la carte (elle agit sur la couche superposée, ou sur le fond de carte quand il n'y en a pas).
- Un bouton « Autre… » pour ajouter autant de cartes que vous voulez (nom, adresse des tuiles, droits d'auteur, clé API facultative, fond ou couche superposée). Chaque carte peut être modifiée avec un crayon ou supprimée avec une croix, et est conservée dans les options du widget.
- Dans un petit widget, le catalogue s'ouvre dans sa propre fenêtre pour pouvoir être lu en entier ; dans une grande zone, il s'ouvre sur place.
- Les boutons et les réglettes s'effacent après trois secondes sans mouvement sur la carte et reviennent au mouvement suivant.
- Un curseur de zoom vertical fin sous les boutons en haut à droite (il n'y a pas de boutons + et −).
- La carte se rouvre là où vous l'avez laissée (position et zoom), et le changement de ligne conserve le zoom choisi. La vue est conservée dans le navigateur de chaque utilisateur, pas dans le document, pour que les personnes ne modifient pas la vue des autres.
- Un bouton en haut à droite ouvre la carte dans une fenêtre séparée, par exemple sur un second écran. La fenêtre suit la ligne sélectionnée dans Grist, et un clic sur une épingle y sélectionne la ligne dans Grist. Fermer la fenêtre, ou le bouton « Réintégrer la carte », ramène la carte dans Grist.
- Interface en français et en anglais, selon la langue du navigateur.

### Installation pas à pas

1. Sur GitHub, ouvrez le dépôt, puis Settings, puis Pages. Sous Source, choisissez « Deploy from a branch », la branche `main` et le dossier `/ (root)`, puis cliquez sur Save. Attendez une à deux minutes.
2. L'adresse du widget est `https://VOTRE-COMPTE.github.io/map_view/index.html`.
3. Dans Grist : Ajouter, puis Ajouter une page, puis choisissez Personnalisée. Collez l'adresse du widget et donnez-lui l'accès en lecture à la table (« Lire la table »).
4. Dans le panneau de droite, sous le niveau d'accès, associez les colonnes : Name, Longitude et Latitude (obligatoires), Description et Color (facultatives).
5. Pour lier la carte à un tableau ou à une fiche, réglez « Sélectionner par » dans chaque widget pour qu'ils partagent la même sélection.

Si votre serveur Grist n'est pas `grist.numerique.gouv.fr`, modifiez deux endroits dans `index.html` : l'adresse du script `grist-plugin-api.js` et l'hôte indiqué dans la ligne Content-Security-Policy située au-dessus.

### Colonnes

Les colonnes sont celles du tableau ci-dessus. Une ligne sans coordonnées (vides ou 0 et 0) est ignorée sans message. Une ligne dont les coordonnées ne sont pas des nombres, ou sortent de la plage valide, est exclue : un bandeau au-dessus de la carte nomme les colonnes à vérifier, le nombre de lignes et quelques exemples. Dans la description, un saut de ligne ou les deux caractères `\n` commencent une nouvelle ligne. Couleurs acceptées : un code HEX comme `#FF0000`, ou un nom (`rouge`, `vert`, `bleu`, `bleu marine`, `bleu ciel`, `jaune`, `orange`, `violet`, `rose`, `gris`, `marron`, `turquoise`, `vert foncé`, `blanc`, `noir` et leurs équivalents anglais). La couleur par défaut est le vert.

### Cartes et droits

Aucune carte n'est stockée dans ce dépôt. La liste des cartes, le fournisseur de chacune et ce que l'on sait de leurs conditions sont dans [MAPS.md](MAPS.md). Les 21 couches IGN viennent du service public Géoplateforme et ne demandent aucune clé (voir `data/README.md`). Le service contient des centaines d'autres couches, mais beaucoup ne fonctionnent pas dans ce widget : elles sont écartées, et « Autre… » permet d'en ajouter une au besoin. Les couches TOPO 25 et « Cartes IGN » ne font pas partie de ce service public. Les cartes dont les conditions n'ont pas pu être confirmées (Esri et d'autres) ne sont pas incluses : voir « Cartes non incluses » dans [MAPS.md](MAPS.md).

### Ajouter une carte avec « Autre… »

L'adresse des tuiles doit commencer par `https://` et contenir `{z}`, `{x}` et `{y}`. Si le fournisseur exige une clé, placez `{apikey}` à l'endroit de la clé et saisissez la clé dans le champ Clé API : sans clé, la fenêtre affiche « Cette carte nécessite une clé API ». La clé est enregistrée en clair dans les options du widget, donc lisible par les personnes qui ont accès au document : restreignez-la à un domaine chez le fournisseur.

### Sécurité et confidentialité

Aucun script externe sauf l'API de plugin Grist, chargée depuis votre serveur Grist. Leaflet et son plugin de regroupement sont embarqués dans `vendor` : rien n'est chargé depuis un CDN. Une politique de sécurité de contenu limite les scripts à ce site et les images à https. Les données du tableau ne sont jamais envoyées. Chaque fournisseur de carte voit l'adresse IP des utilisateurs, la zone affichée et le site qui affiche la carte. Les étiquettes sont construites à partir de texte seul : une description ne peut ni charger d'image ni exécuter de code. Les adresses de tuiles doivent être en https. Les messages entre le widget et la fenêtre séparée ne sont acceptés que du même site et de la fenêtre ouverte par le widget.

Limite connue : la fenêtre séparée garde son lien avec le widget (`window.opener`), car Grist exécute les widgets dans un cadre isolé qui ne peut parler qu'aux fenêtres qu'il a lui-même ouvertes. N'ajoutez que des fournisseurs de cartes de confiance.

### Performance

La carte est créée une seule fois. Changer le fond, la couche superposée ou la transparence ne remplace que les tuiles. Modifier une cellule ne met à jour qu'une épingle. Des milliers d'épingles sont ajoutées par lots et regroupées. Les réglages sont enregistrés au relâchement d'une réglette, pas à chaque cran.

### Publier une modification

Les navigateurs gardent les fichiers de GitHub Pages environ dix minutes. Les scripts et les styles sont appelés avec `?v=0.4.4` : changez ce numéro dans `index.html`, `window.html`, `catalog.html` et `js/window-link.js` à chaque version.

### Fichiers

- `index.html`, `js/main-grist.js` : le widget (connexion à Grist, sélection, fenêtre séparée).
- `window.html`, `js/main-window.js` : la fenêtre séparée de la carte. `catalog.html`, `js/main-catalog.js` : la fenêtre du catalogue. `js/config.js` : lecture des réglages enregistrés.
- `js/app.js` : l'écran de carte commun aux deux. `js/engine.js` : la carte et les épingles. `js/menu.js` : catalogue, fenêtre « Autre », réglette de transparence. `js/catalog.js` : cartes et couches. `js/records.js` : lecture et contrôle des lignes. `js/colors.js` : couleurs des épingles. `js/i18n.js` : textes français et anglais. `js/window-link.js` : lien avec la fenêtre séparée.
- `data/ign-layers.js` : les couches IGN. `vendor` : Leaflet et Leaflet.markercluster.

Licence : MIT. Leaflet est sous licence BSD 2-Clause et Leaflet.markercluster sous licence MIT.

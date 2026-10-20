# Maps and their rights / Cartes et leurs droits

English first, version française plus bas.

## English

The widget never stores any map: each map is loaded directly from its provider server when it is displayed. The attribution shown at the bottom right of the map is the one written for each entry in `js/catalog.js`; keep it visible. This page lists the providers and what is known about their terms. It is information, not legal advice: the providers own the terms, and they can change. Check them before publishing a document or a widget that uses a map.

Verification status: "checked" means the statement comes from a source read while writing this page (see the links); "to check" means that I could not read the provider terms and that you must read them yourself.

| Map in the widget | Provider | What the provider says | Attribution displayed | Status |
|---|---|---|---|---|
| OpenStreetMap Standard | OpenStreetMap Foundation | Data under the ODbL licence: credit "OpenStreetMap contributors" is required. The tile server has a [tile usage policy](https://operations.osmfoundation.org/policies/tiles/): heavy use needs prior permission, and access can be blocked without notice. | OpenStreetMap contributors (link to the copyright page) | Checked on [OpenStreetMap](https://www.openstreetmap.org/copyright) and its [tile policy](https://operations.osmfoundation.org/policies/tiles/) |
| OpenStreetMap France, Humanitarian (HOT) | OpenStreetMap France servers | Tiles served by OpenStreetMap France with OpenStreetMap data (ODbL). Their own usage terms apply. | OpenStreetMap France and OpenStreetMap contributors | To check: [openstreetmap.fr](https://www.openstreetmap.fr/) |
| CyclOSM | CyclOSM project, served by OpenStreetMap France | OpenStreetMap data (ODbL) with the CyclOSM style. | CyclOSM and OpenStreetMap contributors | To check: [cyclosm.org](https://www.cyclosm.org/) |
| Waymarked Trails, cycling routes | Waymarked Trails | OpenStreetMap data. | OpenStreetMap contributors and Waymarked Trails | To check: [waymarkedtrails.org](https://cycling.waymarkedtrails.org/) |
| OpenTopoMap | OpenTopoMap | Tiles under CC-BY-SA 3.0: the licence must be followed and opentopomap.org credited; larger projects should contact the maintainers first. | OpenStreetMap contributors and OpenTopoMap (CC-BY-SA) | Checked on the [OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/OpenTopoMap) |
| Esri Street Map, World Imagery, World Topo Map | Esri | Esri asks for attribution displayed on the map and refers to its own terms of use. I could not confirm whether anonymous access to these tile servers is allowed for any use: one unofficial forum post says a subscription is needed outside Esri software. | Tiles &copy; Esri | To check before any publication: [Esri basemap attribution](https://developers.arcgis.com/documentation/mapping-apis-and-services/deployment/basemap-attribution/) and the terms of the World Street Map and World Imagery items. Remove these maps from `js/catalog.js` if the terms do not suit you. |
| IGN layers (Géoplateforme) | IGN, service `data.geopf.fr` | The WMTS service declares itself "Public" with fees "none", under the terms of [cartes.gouv.fr/cgu](https://cartes.gouv.fr/cgu). The layers come from many producers (IGN, BRGM, INSEE, ADEME, ONF, INRAE and others): each dataset has its own page, linked from the attribution of the map, with its own licence. Public IGN data has been under the Etalab open licence since 2021, but scans and third-party data can have other terms. | &copy; IGN / Géoplateforme (link to the dataset page) | Partly checked: service description read in the GetCapabilities document; licence of each dataset to check on its page |
| Maps added with "Other" | The provider you choose | The widget cannot know the terms of a map you add. You are responsible for them. | The copyright text you type, shown as plain text | Your responsibility |

Notes for people who publish this widget:
- Each map provider sees the IP address of the users and the displayed area, and the site that shows the map. No table data is ever sent.
- An API key typed in the "Other" dialog is stored in the widget options, so people with access to the document can read it. Restrict such a key to a domain at the provider.
- The list of IGN layers was read from the service on 2026-10-20 (see `data/README.md`). Layers can appear, change or disappear: an unavailable layer shows no tiles.

## Français

Le widget ne conserve aucune carte : chaque carte est chargée directement depuis le serveur de son fournisseur au moment de l'affichage. La mention de droits affichée en bas à droite de la carte est celle écrite pour chaque entrée dans `js/catalog.js` ; elle doit rester visible. Cette page liste les fournisseurs et ce que l'on sait de leurs conditions. Elle donne une information et non un avis juridique : les conditions appartiennent aux fournisseurs et peuvent changer. Vérifiez-les avant de publier un document ou un widget qui utilise une carte.

État de la vérification : « vérifié » signifie que l'information vient d'une source lue pendant la rédaction de cette page (liens ci-dessus) ; « à vérifier » signifie que les conditions du fournisseur n'ont pas pu être lues et qu'il faut les consulter vous-même.

Le tableau ci-dessus donne, pour chaque carte, le fournisseur, ses conditions connues, la mention de droits affichée et l'état de la vérification. En résumé :
- OpenStreetMap Standard : données sous licence ODbL, mention « OpenStreetMap contributors » obligatoire, politique d'usage des tuiles à respecter (usage intensif soumis à autorisation). Vérifié.
- OpenStreetMap France, Humanitaire (HOT), CyclOSM, Waymarked Trails : données OpenStreetMap ; conditions de chaque serveur à vérifier.
- OpenTopoMap : licence CC-BY-SA 3.0, avec mention de opentopomap.org ; contacter les mainteneurs pour un projet important. Vérifié.
- Esri (Street Map, World Imagery, World Topo Map) : mention Esri obligatoire ; je n'ai pas pu confirmer que l'accès anonyme à ces serveurs est autorisé pour tout usage. À vérifier avant toute publication, et à retirer de `js/catalog.js` si les conditions ne conviennent pas.
- Couches IGN (Géoplateforme) : service déclaré « Public » et sans frais, conditions générales de cartes.gouv.fr. Les couches viennent de nombreux producteurs (IGN, BRGM, INSEE, ADEME, ONF, INRAE et autres) : chaque jeu de données a sa page, accessible depuis la mention de droits de la carte, avec sa licence. Les données publiques de l'IGN sont sous Licence Ouverte Etalab depuis 2021, mais les scans et les données de tiers peuvent avoir d'autres conditions. À vérifier jeu de données par jeu de données.
- Cartes ajoutées par « Autre… » : vous en êtes responsable.

Pour les personnes qui publient ce widget : chaque fournisseur voit l'adresse IP des utilisateurs, la zone affichée et le site qui affiche la carte, mais jamais les données du tableau. Une clé API saisie dans la fenêtre « Autre » est enregistrée dans les options du widget, donc lisible par les personnes qui ont accès au document : restreignez-la à un domaine chez le fournisseur. La liste des couches IGN a été lue sur le service le 20 octobre 2026 (voir `data/README.md`) ; une couche indisponible n'affiche aucune tuile.

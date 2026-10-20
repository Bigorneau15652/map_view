ign-layers.js lists the IGN layers of the Géoplateforme WMTS service that can be displayed without
any key (Web Mercator image layers). It was produced from the GetCapabilities document of
https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities read on 2026-10-20.
The service describes itself as Public, with fees "none", under the terms of https://cartes.gouv.fr/cgu.
Excluded: Lambert 93 variants, raw elevation grids (not images), test layers and layers announced as obsolete.
To refresh the list, read the GetCapabilities document again and rebuild the rows:
[layer id, title, format (j = jpeg, p = png), min zoom, max zoom, style id, theme, dataset id].

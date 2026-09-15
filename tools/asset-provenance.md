# Car asset provenance

Model authors, titles, original Sketchfab URLs, licences, and modifications are preserved in `public/models/credits.json` and displayed on `/credits.html`.

Source distribution mirrors used to retrieve the downloadable assets:

- Porsche, Ford, McLaren: [Nissmo89/Supercar-Vault-3D](https://github.com/Nissmo89/Supercar-Vault-3D/tree/main/models), with embedded Sketchfab author/source/licence metadata.
- Mini: [AlexeyIK/auto-configurator](https://github.com/AlexeyIK/auto-configurator/tree/develop/Assets/Resources/Cars/Mini%20F56), with embedded Sketchfab CC BY 4.0 metadata.
- Aston: [cmourglia/spark-gl](https://github.com/cmourglia/spark-gl/tree/master/resources/models/2017_aston_martin_db11_5.2l_twin-turbo_v12), with embedded Sketchfab CC BY 4.0 metadata.
- BMW: [coopercodes/bmwGLB](https://github.com/coopercodes/bmwGLB), with embedded metadata and matching author/licence attribution in that repository's README.

Assets were processed with glTF Transform: flattening, mesh/material joining, welding, simplification, texture resizing/WebP conversion, and Meshopt compression. WebP textures use a 1024-pixel limit for detailed variants and 512 pixels for performance variants; KTX2 sources retain their original resolution. Performance variants use more aggressive geometry simplification. Models are normalised in `src/car-models.js` for consistent scale and orientation. Shared decoded assets are cached; scene instances do not dispose shared GPU resources when swapping cars.

Model renders were produced locally from those same game assets using `tools/showroom.html` and `tools/capture-cars.mjs`. README screenshots come from the running game via `tools/capture-app.mjs`.

The Porsche and Ford source models and derivatives remain CC BY-NC-SA 4.0. Other car source models and derivatives remain CC BY 4.0. The game code is separate from these asset licences.

## Retro expansion

The additional models are mirrored in [JamieGeddes/marque](https://github.com/JamieGeddes/marque/tree/main/public/models). Each source model embeds Sketchfab author, source URL and licence metadata matching its accompanying `assets-src/<id>/LICENSE.txt`. Those licence files are retained in `public/models/licenses/`; the original artist data is retained in `public/models/credits.json`.

The expansion preserves source KTX2 GPU-compressed textures. Such textures are not resized by the WebP processing step and retain their source resolution. Adaptive/performance variants simplify geometry further. KTX2 decoding uses the Three.js/Basis transcoder, included with its licence in `public/decoders/`.

The social preview includes a render of James Slater’s CC BY 4.0 Lancia Stratos, attributed in the model credits.

## Full catalogue

`tools/catalogue-sources.json` records the audited entries from Marque and Supercar Vault 3D, including exact-source duplicates already covered by a garage model. All remaining downloads had matching licence files and embedded original-artist metadata. The catalogue now contains 133 distinct model assets. Some vehicles appear in more than one source variant.

The full catalogue expansion uses one browser-optimised model per entry at all quality levels, avoiding duplicate downloads. Existing cars retain their detailed/performance variants. Car names and years were read from Marque’s catalogue; the five performance ratings, classes and credit prices are Slot Club gameplay values.

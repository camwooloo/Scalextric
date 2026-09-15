# Car asset provenance

Model authors, titles, original Sketchfab URLs, licences, and modifications are preserved in `public/models/credits.json` and displayed on `/credits.html`.

Source distribution mirrors used to retrieve the downloadable assets:

- Porsche, Ford, McLaren: [Nissmo89/Supercar-Vault-3D](https://github.com/Nissmo89/Supercar-Vault-3D/tree/main/models), with embedded Sketchfab author/source/licence metadata.
- Mini: [AlexeyIK/auto-configurator](https://github.com/AlexeyIK/auto-configurator/tree/develop/Assets/Resources/Cars/Mini%20F56), with embedded Sketchfab CC BY 4.0 metadata.
- Aston: [cmourglia/spark-gl](https://github.com/cmourglia/spark-gl/tree/master/resources/models/2017_aston_martin_db11_5.2l_twin-turbo_v12), with embedded Sketchfab CC BY 4.0 metadata.
- BMW: [coopercodes/bmwGLB](https://github.com/coopercodes/bmwGLB), with embedded metadata and matching author/licence attribution in that repository's README.

Assets were processed with glTF Transform: flattening, mesh/material joining, welding, simplification, texture resizing/WebP conversion, and Meshopt compression. Detailed variants use a 1024-pixel texture limit; performance variants use 512 pixels and more aggressive geometry simplification. Models are normalised in `src/car-models.js` for consistent scale and orientation. Shared decoded assets are cached; scene instances do not dispose shared GPU resources when swapping cars.

Model renders were produced locally from those same game assets using `tools/showroom.html` and `tools/capture-cars.mjs`. README screenshots come from the running game via `tools/capture-app.mjs`.

The Porsche and Ford source models and derivatives remain CC BY-NC-SA 4.0. Other car source models and derivatives remain CC BY 4.0. The game code is separate from these asset licences.

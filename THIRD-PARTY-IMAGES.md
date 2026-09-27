# Image compatibility dependency

`advacon-heic-1.5.2.mjs` is the unmodified CSP ES module from **heic-to 1.5.2**, distributed under LGPL-3.0. See `advacon-heic-LICENSE.txt` in this directory. It contains the libheif decoder; its authors' license/source information remains in the distributed code.

Package/source: https://www.npmjs.com/package/heic-to/v/1.5.2

Corresponding source and build instructions: https://github.com/hoppergee/heic-to

Underlying decoder source: https://github.com/strukturag/libheif/tree/v1.22.2

The dependency is a separate dynamically imported file and can be replaced independently. No request photos are transmitted to the library publisher or a conversion service. Conversion happens locally in the browser. The application uploads only the resulting supported image to its existing Supabase storage.

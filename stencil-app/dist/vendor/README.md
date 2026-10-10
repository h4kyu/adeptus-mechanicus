# Local SVG export dependency

`polygon-clipping.mjs` vendors polygon-clipping 0.15.7 from
https://cdn.jsdelivr.net/npm/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js
(upstream: https://github.com/mfogel/polygon-clipping).

The upstream UMD bundle is unchanged except removal of its source-map URL.
A local `module` / `exports` wrapper and default ES module export were added so
both browser module workers and Node tests can use it without a global or CDN.
No runtime network requests or package installation are needed.

The bundle contains splaytree 3.1.2 and robust-predicates. See the adjacent
licenses and the retained Apache-2.0 notice for TypeScript helper code.

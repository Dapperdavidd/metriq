# The Field Manual

`Metriq-Field-Manual.pdf` is a step-by-step reading of the whole codebase: what was
built, why each piece is shaped the way it is, and where to put your hands to change it.
Thirteen chapters, from the one law (decline, never revert) out through the three planes
to the on-chain zero-knowledge reveal, with `why` / `council's call` / `gotcha` / `try it`
asides throughout.

## Regenerate

The source of truth is `metriq-book.html` (self-contained, styled in the Grid Fermé
palette). The PDF is rendered with headless Chrome, no toolchain to install:

```bash
cd book
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-pdf-header-footer \
  --print-to-pdf=Metriq-Field-Manual.pdf \
  "file://$(pwd)/metriq-book.html"
```

Edit the HTML, re-run, done. Any modern Chromium works.

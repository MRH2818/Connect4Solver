# webapp

Pure front-end implementation of an N-dimensional Connect-Four style game.

## Features

- No Node.js/Vite/React build tooling required.
- Raw HTML/CSS/JavaScript with jQuery.
- Configurable board size, dimensions, gravity axis, and connect length.
- 2D view for classic gameplay.
- 3D isometric canvas view (for dimensions >= 3).
- 4D+ slice explorer via configurable axis slicing.
- Optional AI player running in a Web Worker.

## Run

Open `index.html` directly in a browser.

If your browser blocks Worker loading from local files (`file://`), run a tiny static server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/webapp/`.

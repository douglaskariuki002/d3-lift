# Lift3D

A small D3-powered demo that lifts tabular data into 3D space and projects it back onto a 2D SVG canvas. The project is organized into a reusable library plus a demo script.

## Project structure

- `d3-lift.html` — the demo page and UI shell
- `lif3d.js` — reusable Lift3D library
- `demo.js` — sample data and event wiring for the page

## What it does

- Accepts array-of-objects data such as rows in a table
- Lifts numeric columns into a 3D coordinate system
- Supports multiple modes:
  - `axes`: choose x/y/z columns manually
  - `pca`: project numeric data into principal-component space
  - `grid`: render rows and columns as a surface
- Renders the result with D3 and SVG
- Lets the user rotate, zoom, and inspect data values interactively

## Run locally

Because this is a browser-based demo, you can open the HTML file directly in a browser, or serve the folder with a simple local web server.

Example:

```bash
cd c:\Users\Administrator\projects\d3-lift
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/d3-lift.html
```

## Notes

- The page expects D3 7.9.0 to be loaded before the application code runs.
- The reusable library is intentionally separated from the demo logic for easier reuse in other projects.

## Example usage

```js
const scene = Lift3D.create(svgElement, rows, {
  mode: 'axes',
  x: 'horsepower',
  y: 'weight',
  z: 'mpg',
  color: 'origin',
  size: 'price'
});
```

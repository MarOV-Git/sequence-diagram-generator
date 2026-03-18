# Sequence Diagram Generator

A web-based tool for creating, editing, and exporting UML sequence diagrams. Built with Streamlit and vanilla JavaScript — no diagram library dependencies.

![Python](https://img.shields.io/badge/Python-3.9+-blue) ![Streamlit](https://img.shields.io/badge/Streamlit-1.x-red) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)

---

## Features

- **Live XML editor** — write your diagram in a simple XML format and load it instantly
- **Interactive layout** — drag participant headers horizontally to reposition lanes
- **Drag messages** — move arrows up and down along the lifeline
- **Self-loops** — supported with adjustable height (Shift+drag on the handle)
- **Return messages** — rendered as dashed arrows when `return="true"` is set
- **Auto-layout** — one-click horizontal spacing based on label width
- **Auto vertical spacing** — distributes messages evenly along the lifeline
- **Renumber** — reorders step badges after manual rearrangement
- **Color customization** — badge color, header background and border
- **Export** — XML, SVG, PNG and JPG (1x–4x scale)
- **Zoom controls** — in/out/reset with live percentage display

---

## Getting Started

### Requirements

- Python 3.9+
- Streamlit

```bash
pip install streamlit
```

### Run

```bash
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

---

## XML Format

Diagrams are defined in a straightforward XML structure:

```xml
<sequence title="My Diagram">
  <participants>
    <p id="client"  label="Client"   highlight="true"/>
    <p id="api"     label="API"/>
    <p id="db"      label="Database"/>
  </participants>

  <messages>
    <m step="1" from="client" to="api"    text="POST /login"/>
    <m step="2" from="api"    to="db"     text="SELECT user"/>
    <m step="3" from="db"     to="api"    text="user row"       return="true"/>
    <m step="4" from="api"    to="api"    text="validate token"/>
    <m step="5" from="api"    to="client" text="200 OK"         return="true"/>
  </messages>
</sequence>
```

### Attributes

**`<sequence>`**
| Attribute | Description |
|-----------|-------------|
| `title`   | Diagram title shown at the top |

**`<p>` — participant**
| Attribute   | Values          | Description |
|-------------|-----------------|-------------|
| `id`        | string          | Unique identifier used in messages |
| `label`     | string          | Display name on the header |
| `highlight` | `true` / `false`| Adds visual emphasis to the header |

**`<m>` — message**
| Attribute | Values           | Description |
|-----------|------------------|-------------|
| `step`    | number / string  | Badge label |
| `from`    | participant id   | Sender |
| `to`      | participant id   | Receiver (same as `from` for self-loops) |
| `text`    | string           | Arrow label |
| `return`  | `true` / `false` | Renders as a dashed arrow |

---

## Interface

```
┌─────────────────────┬──────────────────────────────────────────┐
│  XML Editor         │  Diagram Viewer                          │
│                     │  ┌──────────────────────────────────┐    │
│  <sequence ...>     │  │ Auto width │ Space V │ Renumber  │    │
│    ...              │  │ Export XML │ SVG │ PNG │ JPG     │    │
│  </sequence>        │  │ − 100% +  Reset                  │    │
│                     │  └──────────────────────────────────┘    │
│  [Load Viewer]      │                                          │
│  [Export XML]       │         [ interactive SVG ]              │
│                     │                                          │
└─────────────────────┴──────────────────────────────────────────┘
```

### Toolbar (inside viewer)

| Button | Action |
|--------|--------|
| Auto width | Recalculates horizontal spacing based on label widths |
| Space V | Redistributes messages evenly along the vertical axis |
| Renumber | Reassigns step badges in top-to-bottom order |
| Export XML | Downloads the current diagram state (including drag edits) |
| SVG / PNG / JPG | Image export at the selected scale (1x–4x) |
| Download Template | Downloads a starter XML file |

### Tips

- Drag a **header** left or right to reposition a participant lane
- Drag the **● handle** on any arrow to move it vertically
- **Shift+drag** the handle on a self-loop to resize its height
- Use **Export XML** from the toolbar (not the sidebar) to preserve drag edits

---

## Project Structure

```
sequence-diagram-generator/
├── app.py                  # Streamlit app — layout, config, file I/O
├── assets/
│   ├── index.html          # Viewer shell — toolbar and SVG container
│   ├── js/
│   │   └── app.js          # Diagram engine — model, layout, render, drag
│   └── css/
│       └── app.css         # Styles
└── utils/
    └── xml_utils.py        # Default XML template
```

---

## License

MIT

import json
from pathlib import Path

import streamlit as st
from utils.xml_utils import DEFAULT_XML, normalize_xml_for_html
from streamlit.components.v1 import html as st_html

st.set_page_config(page_title="Sequence Diagram Generator", layout="wide")
st.title("Sequence Diagram Generator")

MIN_GAP_H_DEFAULT   = 140
MAX_GAP_H_DEFAULT   = 520
MIN_GAP_V_DEFAULT   = 60
LIFELINE_H_DEFAULT  = 700
NEIGHBOR_PAD        = 12

STUB_LIMIT_SELF_DEF = 260
MIN_GAP_SELF_DEF    = 220
MIN_GAP_NONSELF_DEF = MIN_GAP_H_DEFAULT

AUTOLAYOUT_PASSES_DEF = 1
SPACEV_PASSES_DEF     = 5

HEADER_FONT_SIZE_DEF   = 20
HEADER_FONT_WEIGHT_DEF = "700"
LABEL_FONT_SIZE_DEF    = 14

ss = st.session_state

if "xml_text" not in ss:
    ss.xml_text = DEFAULT_XML
if "effective_xml" not in ss:
    ss.effective_xml = ss.xml_text
if "uploader_had_file" not in ss:
    ss.uploader_had_file = False

if "badge_color" not in ss:
    ss.badge_color = "#2563EB"
if "header_fill" not in ss:
    ss.header_fill = "#FFFFFF"
if "header_stroke" not in ss:
    ss.header_stroke = "#CFCFCF"

colL, colR = st.columns([0.42, 0.58], gap="large")

with colL:
    up = st.file_uploader("XML File (optional)", type=["xml"], key="xml_uploader")

    with st.expander("Appearance (optional)", expanded=False):
        c1, c2, c3 = st.columns(3)
        with c1:
            st.color_picker("Badges", key="badge_color")
        with c2:
            st.color_picker("Header background", key="header_fill")
        with c3:
            st.color_picker("Header border", key="header_stroke")

    ss.xml_text = st.text_area(
        "Input XML (editable)",
        value=ss.xml_text,
        height=360,
        help="The viewer validates and shows errors if there's invalid XML."
    )

    b1, b2, b3 = st.columns([0.5, 0.25, 0.25])
    with b1:
        cargar_click = st.button("Load Viewer", type="primary", use_container_width=True)
    with b2:
        st.download_button(
            "Export XML",
            data=ss.get("effective_xml", ss.xml_text),
            file_name="diagram.xml",
            mime="application/xml",
            use_container_width=True
        )
    with b3:
        import json as _json
        xml_for_js = _json.dumps(ss.xml_text)
        st.components.v1.html(
            f"""
            <button id="copyXML"
              title="Copy XML"
              style="
                width:42px;height:42px;display:flex;align-items:center;justify-content:center;
                border:0;background:transparent;cursor:pointer;border-radius:8px;opacity:.7;
              "
              aria-label="Copy XML"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <script>
              const data = {xml_for_js};
              const btn = document.getElementById('copyXML');
              btn.onclick = async () => {{
                try {{
                  await navigator.clipboard.writeText(data);
                  btn.style.opacity = 1;
                  setTimeout(()=>btn.style.opacity = .7, 800);
                }} catch(e) {{
                  alert('Could not copy: ' + e);
                }}
              }};
            </script>
            """,
            height=50
        )

    st.info(
        "Tips:\n"
        "- Drag headers to move lanes (limited to not cross neighbors).\n"
        "- ● moves the Y of each arrow; Shift+drag on self-loop changes its height.\n" 
    )

trigger_actions = False

if cargar_click:
    if up is not None:
        file_xml = up.read().decode("utf-8", errors="ignore")
        ss.xml_text = file_xml
        ss.effective_xml = file_xml
        trigger_actions = True
        ss.uploader_had_file = True
    else:
        ss.effective_xml = ss.xml_text
        trigger_actions = True
        ss.uploader_had_file = False

current_has_file = (up is not None)
if ss.uploader_had_file and not current_has_file:
    ss.effective_xml = ss.xml_text
    trigger_actions = True
ss.uploader_had_file = current_has_file

assets_dir = Path(__file__).parent / "assets"
index_html_path = assets_dir / "index.html"
css_path = assets_dir / "css" / "app.css"
js_path = assets_dir / "js" / "app.js"

index_html = index_html_path.read_text(encoding="utf-8")
css_text = css_path.read_text(encoding="utf-8")
js_text = js_path.read_text(encoding="utf-8")

index_html_inlined = (
    index_html
    .replace('<link rel="stylesheet" href="css/app.css">', f"<style>\n{css_text}\n</style>")
    .replace('<script src="js/app.js" defer></script>', f"<script>\n{js_text}\n</script>")
)

xml_payload = normalize_xml_for_html(ss.effective_xml)

config_dict = {
    "BADGE_COLOR": ss.badge_color,
    "HEADER_FILL": ss.header_fill,
    "HEADER_STROKE": ss.header_stroke,
    "HEADER_FONT_SIZE": HEADER_FONT_SIZE_DEF,
    "HEADER_FONT_WEIGHT": HEADER_FONT_WEIGHT_DEF,
    "LABEL_FONT_SIZE": LABEL_FONT_SIZE_DEF,

    "MIN_GAP": MIN_GAP_H_DEFAULT,
    "MAX_GAP": MAX_GAP_H_DEFAULT,
    "MIN_Y_GAP": MIN_GAP_V_DEFAULT,
    "LIFELINE_H": LIFELINE_H_DEFAULT,
    "NEIGHBOR_PAD": NEIGHBOR_PAD,

    "STUB_LIMIT_SELF": STUB_LIMIT_SELF_DEF,
    "MIN_GAP_NONSELF": MIN_GAP_NONSELF_DEF,
    "MIN_GAP_SELF": MIN_GAP_SELF_DEF,

    "AUTOLAYOUT_PASSES": AUTOLAYOUT_PASSES_DEF,
    "SPACEV_PASSES": SPACEV_PASSES_DEF,

    "KICK_SPACEV": 1 if trigger_actions else 0,

    "SELF_LABEL_RATIO": 0.70
}

config_json = json.dumps(config_dict, ensure_ascii=False)

html_with_payloads = (
    index_html_inlined
    .replace("<!--XML_PAYLOAD-->", xml_payload)
    .replace("/*INIT_CONFIG_JSON*/", config_json)
)

st.markdown(
    """
    <style>
      iframe[title="st.components.v1.html"] {
        pointer-events: none !important;
        overflow: hidden !important;
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
        position: relative !important;
      }
      iframe[title="st.components.v1.html"]::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
      iframe[title="st.components.v1.html"] body {
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      div[data-testid="stIFrame"] {
        border: none !important;
        outline: none !important;
      }
      .stIFrame {
        border-radius: 8px !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

with colR:
    st_html(html_with_payloads, height=920, scrolling=False)
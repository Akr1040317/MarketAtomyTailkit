from pathlib import Path

html = Path("/Users/akshatrastogi/Downloads/dashboard.html").read_text()
css = html[html.find("<style>") + 7 : html.find("</style>")]
assessment = Path("/Users/akshatrastogi/Downloads/assessment.html").read_text()
# page-specific assessment CSS lives in a second style block in the body
parts = assessment.split("<style>")
extra_assessment = ""
if len(parts) > 2:
    extra_assessment = parts[2].split("</style>", 1)[0]
scope = ".ma-dash"


def prefix_selector(sel: str):
    sel = sel.strip()
    if not sel:
        return None
    if sel.startswith(":root") or sel.startswith("html") or sel == "body":
        return scope
    if sel == "*":
        return f"{scope} *"
    return f"{scope} {sel}"


def prefix_chunk(chunk: str) -> str:
    out = []
    i = 0
    n = len(chunk)
    while i < n:
        if chunk.startswith("/*", i):
            j = chunk.find("*/", i + 2)
            out.append(chunk[i : j + 2])
            i = j + 2
            continue
        if chunk[i].isspace():
            out.append(chunk[i])
            i += 1
            continue
        brace = chunk.find("{", i)
        if brace < 0:
            out.append(chunk[i:])
            break
        selectors = chunk[i:brace]
        j = brace + 1
        depth = 1
        while j < n and depth:
            if chunk[j] == "{":
                depth += 1
            elif chunk[j] == "}":
                depth -= 1
            j += 1
        body = chunk[brace:j]
        sels = [prefix_selector(s) for s in selectors.split(",") if prefix_selector(s)]
        if sels:
            out.append(", ".join(sels) + body)
        i = j
    return "".join(out)


def transform(css_text: str) -> str:
    out = []
    i = 0
    n = len(css_text)
    while i < n:
        if css_text.startswith("/*", i):
            j = css_text.find("*/", i + 2)
            out.append(css_text[i : j + 2])
            i = j + 2
            continue
        if css_text[i].isspace():
            out.append(css_text[i])
            i += 1
            continue
        if css_text.startswith("@media", i) or css_text.startswith("@keyframes", i):
            brace = css_text.find("{", i)
            out.append(css_text[i : brace + 1])
            i = brace + 1
            depth = 1
            inner_start = i
            while i < n and depth:
                if css_text[i] == "{":
                    depth += 1
                elif css_text[i] == "}":
                    depth -= 1
                i += 1
            out.append(prefix_chunk(css_text[inner_start : i - 1]))
            out.append("}")
            continue
        brace = css_text.find("{", i)
        if brace < 0:
            out.append(css_text[i:])
            break
        selectors = css_text[i:brace]
        j = brace + 1
        depth = 1
        while j < n and depth:
            if css_text[j] == "{":
                depth += 1
            elif css_text[j] == "}":
                depth -= 1
            j += 1
        body = css_text[brace:j]
        sels = [prefix_selector(s) for s in selectors.split(",") if prefix_selector(s)]
        if sels:
            out.append(", ".join(sels) + body)
        i = j
    return "".join(out)


header = """/* MarketAtomy client workspace — scoped from Claude Design */
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap");

.ma-dash {
  min-height: 100vh;
}

.ma-dash button {
  background: none;
}

.ma-dash input,
.ma-dash textarea,
.ma-dash select {
  color: #24334a !important;
}

.ma-dash .brand {
  border: 0;
  cursor: pointer;
  width: 100%;
  text-align: left;
  background: none;
}

.ma-dash .brand img {
  background: #fff;
  border-radius: 8px;
  padding: 6px 8px;
}

.ma-dash .nav button {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 42px;
  padding: 0 11px;
  border-radius: 10px;
  color: #aab6c7;
  font-size: 12px;
  font-weight: 650;
  position: relative;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.ma-dash .nav button:hover {
  color: #fff;
  background: rgba(255,255,255,.045);
}

.ma-dash .nav button.active {
  color: #fff;
  background: linear-gradient(90deg,rgba(46,107,176,.20),rgba(43,179,199,.07));
  border: 1px solid rgba(43,179,199,.10);
}

.ma-dash .nav button.active:before {
  content: "";
  position: absolute;
  left: -16px;
  width: 3px;
  height: 24px;
  background: linear-gradient(var(--yellow),var(--orange));
  border-radius: 0 5px 5px 0;
}

.ma-dash .nav button.active .icon {
  color: #5bcbdb;
}

.ma-dash .btn-primary {
  background: linear-gradient(90deg,var(--orange),var(--yellow)) !important;
  color: #fff;
}

.ma-dash .btn-secondary {
  background: #fff !important;
  color: #405067;
}

.ma-dash .btn-navy {
  background: var(--navy) !important;
  color: #fff;
}

.ma-dash .panel-link {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--royal);
  font-size: 9px;
  font-weight: 800;
}

.ma-dash .sidebar-backdrop {
  display: none;
}

@media (max-width: 650px) {
  .ma-dash .sidebar.open {
    display: flex;
    width: min(250px, 86vw);
  }
  .ma-dash .sidebar-backdrop.show {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(5,11,24,.45);
    z-index: 35;
  }
}

"""

out = Path("/Users/akshatrastogi/MarketAtomyFinal2025/MarketAtomyTailkit/src/assets/dashboard-preview.css")
out.write_text(header + transform(css) + "\n" + transform(extra_assessment))
print("wrote", out, out.stat().st_size)

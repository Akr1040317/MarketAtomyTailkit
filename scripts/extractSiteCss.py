from pathlib import Path

html = Path("/Users/akshatrastogi/Downloads/marketatomy_features_page.html").read_text()
css = html[html.find("<style>") + 7 : html.find("</style>")]
scope = ".ma-site"


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


header = """/* MarketAtomy Features / Assessment / About — scoped from Claude Design */
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap");

.ma-site {
  min-height: 100vh;
}

.ma-site button {
  background: none;
}

.ma-site .logo img,
.ma-site .footer-logo,
.ma-site .hero-card img {
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
}

.ma-site .nav-menu-btn {
  display: none;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  color: #fff;
  align-items: center;
  justify-content: center;
}

.ma-site .mobile-links {
  display: none;
}

@media (max-width: 930px) {
  .ma-site .nav-menu-btn {
    display: inline-flex;
  }

  .ma-site .mobile-links.open {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 20px 16px;
    border-top: 1px solid rgba(255,255,255,.08);
    background: rgba(16,27,49,.96);
  }

  .ma-site .mobile-links a {
    text-align: left;
    color: #cbd5e1;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 4px;
  }
}

"""

out = Path("/Users/akshatrastogi/MarketAtomyFinal2025/MarketAtomyTailkit/src/assets/site-preview.css")
out.write_text(header + transform(css))
print("wrote", out, out.stat().st_size)

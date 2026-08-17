from pathlib import Path

src = Path("/Users/akshatrastogi/Downloads/preview.html").read_text()
start = src.find("<style>") + len("<style>")
end = src.find("</style>")
css = src[start:end]


def prefix_selector(sel: str):
    sel = sel.strip()
    if not sel:
        return None
    if sel.startswith(":root"):
        return ".ma-landing"
    if sel.startswith("html"):
        return ".ma-landing"
    if sel == "*":
        return ".ma-landing *"
    if sel == "body":
        return ".ma-landing"
    return ".ma-landing " + sel


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
        sels = [prefix_selector(s) for s in selectors.split(",")]
        sels = [s for s in sels if s]
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
            inner = css_text[inner_start : i - 1]
            out.append(prefix_chunk(inner))
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
        sels = [prefix_selector(s) for s in selectors.split(",")]
        sels = [s for s in sels if s]
        if sels:
            out.append(", ".join(sels) + body)
        i = j
    return "".join(out)


header = """/* MarketAtomy landing page — scoped from Claude Design preview.html */
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap");

.ma-landing {
  min-height: 100vh;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
}

.ma-landing button {
  background: none;
}

"""

out = Path("/Users/akshatrastogi/MarketAtomyFinal2025/MarketAtomyTailkit/src/assets/landing-preview.css")
out.write_text(header + transform(css))
print("wrote", out, "bytes", out.stat().st_size)

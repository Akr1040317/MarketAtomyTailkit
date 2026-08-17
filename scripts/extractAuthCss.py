from pathlib import Path

ROOT = Path("/Users/akshatrastogi/MarketAtomyFinal2025/MarketAtomyTailkit")


def extract_css(html_path: Path) -> str:
    src = html_path.read_text()
    start = src.find("<style>") + len("<style>")
    end = src.find("</style>")
    return src[start:end]


def make_prefixer(scope: str):
    def prefix_selector(sel: str):
        sel = sel.strip()
        if not sel:
            return None
        if sel.startswith(":root"):
            return scope
        if sel.startswith("html"):
            return scope
        if sel == "*":
            return f"{scope} *"
        if sel == "body":
            return scope
        return f"{scope} {sel}"

    return prefix_selector


def prefix_chunk(chunk: str, prefix_selector) -> str:
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


def transform(css_text: str, scope: str) -> str:
    prefix_selector = make_prefixer(scope)
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
            out.append(prefix_chunk(inner, prefix_selector))
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


header = """/* MarketAtomy auth pages — scoped from Claude Design sign-in/sign-up previews */

.ma-auth {
  min-height: 100vh;
}

.ma-auth input,
.ma-auth textarea,
.ma-auth select {
  color: #fff !important;
}

.ma-auth button {
  background: none;
}

.ma-auth .logo img {
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
}

.ma-auth .toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #8390a3;
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
}

.ma-auth .toggle-password:hover {
  color: #fff;
}

.ma-auth .input-wrap input {
  padding-right: 42px;
}

.ma-auth .auth-alert {
  margin: 0 0 14px;
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 12px;
}

.ma-auth .auth-alert.error {
  color: #ff8d85;
  background: rgba(255, 75, 62, 0.08);
  border: 1px solid rgba(255, 75, 62, 0.22);
}

.ma-auth .auth-alert.success {
  color: #32d6aa;
  background: rgba(39, 207, 157, 0.10);
  border: 1px solid rgba(39, 207, 157, 0.22);
}

.ma-auth .field-hint {
  margin-top: 6px;
  font-size: 11px;
}

.ma-auth .field-hint.ok {
  color: #32d6aa;
}

.ma-auth .field-hint.bad {
  color: #ff8d85;
}

.ma-auth .name-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ma-auth .forgot {
  border: 0;
  background: none;
  padding: 0;
  cursor: default;
}

.ma-auth .checkbox-row a,
.ma-auth .checkbox-row span.linkish {
  color: #44cde9;
  font-weight: 700;
}

@media (max-width: 560px) {
  .ma-auth .name-grid {
    grid-template-columns: 1fr;
  }
}

"""

if __name__ == "__main__":
    login_css = transform(
        extract_css(Path("/Users/akshatrastogi/Downloads/preview (1).html")),
        ".ma-auth-login",
    )
    signup_css = transform(
        extract_css(Path("/Users/akshatrastogi/Downloads/preview (2).html")),
        ".ma-auth-signup",
    )

    out = ROOT / "src/assets/auth-preview.css"
    out.write_text(header + "\n/* --- Sign in --- */\n" + login_css + "\n/* --- Sign up --- */\n" + signup_css)
    print("wrote", out, "bytes", out.stat().st_size)

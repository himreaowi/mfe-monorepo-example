"""Generate the three MFE monorepo diagrams (diagram-design method, template teal skin).

Usage (from the repo root): python3 docs/diagrams/source/diagrams.py docs/diagrams
Writes <name>.html (standalone page) and <name>.svg (the page's <svg>, width 1280) for each
diagram. PNGs come from shoot.cjs. Plain Python 3, no dependencies.
"""
import pathlib, sys

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

# Skin: mapped from @org/design-tokens (light)
PAPER = "#f1f5f4"
INK = "#0f172a"
MUTED = "#475569"
SOFT = "#556072"
ACCENT = "#0f766e"
ACCENT_TINT = "rgba(15,118,110,0.08)"
LINK = "#2e5aa8"
RULE = "rgba(15,23,42,0.12)"

SANS = "'Geist', system-ui, sans-serif"
MONO = "'Geist Mono', ui-monospace, monospace"
SERIF = "'Instrument Serif', 'Noto Serif', serif"

TREAT = {
    "focal": (ACCENT_TINT, ACCENT, ""),
    "backend": ("#ffffff", INK, ""),
    "store": ("rgba(15,23,42,0.05)", MUTED, ""),
    "external": ("rgba(15,23,42,0.03)", "rgba(15,23,42,0.30)", ""),
    "input": ("rgba(71,85,105,0.10)", SOFT, ""),
    "private": ("#ffffff", INK, ""),
}


def mono_w(text, size):
    """Width budget: 0.62em per mono char, padded, rounded up to 4."""
    w = len(text) * 0.62 * size + 16
    return int(-(-w // 4) * 4)


def node(x, y, w, h, kind, tag, name, sub):
    fill, stroke, dash = TREAT[kind]
    tag_w = mono_w(tag, 8) - 4
    cx = x + w / 2
    out = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{PAPER}"/>',
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"/>',
        f'<rect x="{x+8}" y="{y+8}" width="{tag_w}" height="12" rx="2" fill="none" stroke="{stroke}" stroke-opacity="0.5" stroke-width="0.8"/>',
        f'<text x="{x+8+tag_w/2}" y="{y+17}" fill="{stroke if kind!="external" else SOFT}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.08em">{tag}</text>',
        f'<text x="{cx}" y="{y+h/2+8}" fill="{INK}" font-size="16" font-weight="600" font-family="{SANS}" text-anchor="middle">{name}</text>',
        f'<text x="{cx}" y="{y+h/2+26}" fill="{MUTED}" font-size="12" font-family="{MONO}" text-anchor="middle">{sub}</text>',
    ]
    return "\n".join(out)


def label(cx, y_top, text, color=SOFT):
    w = mono_w(text, 12)
    return (
        f'<rect x="{cx-w/2}" y="{y_top}" width="{w}" height="16" rx="2" fill="{PAPER}"/>'
        f'<text x="{cx}" y="{y_top+12}" fill="{color}" font-size="12" font-family="{MONO}" text-anchor="middle" letter-spacing="0.06em">{text}</text>'
    )


def label_left(x, y_top, text, color=SOFT):
    w = mono_w(text, 12)
    return (
        f'<rect x="{x}" y="{y_top}" width="{w}" height="16" rx="2" fill="{PAPER}"/>'
        f'<text x="{x+w/2}" y="{y_top+12}" fill="{color}" font-size="12" font-family="{MONO}" text-anchor="middle" letter-spacing="0.06em">{text}</text>'
    )


def zone(x, y, w, h, text):
    lw = mono_w(text, 8)
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="rgba(15,23,42,0.02)" stroke="rgba(15,23,42,0.14)" stroke-width="0.8"/>'
        f'<rect x="{x+16}" y="{y+4}" width="{lw}" height="12" rx="2" fill="{PAPER}"/>'
        f'<text x="{x+16+lw/2}" y="{y+13}" fill="{SOFT}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.14em">{text}</text>'
    )


def legend(y, items):
    out = [
        f'<line x1="40" y1="{y-8}" x2="1240" y2="{y-8}" stroke="{RULE}" stroke-width="0.8"/>',
        f'<text x="40" y="{y+16}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.14em">LEGEND</text>',
    ]
    x = 140
    for kind, text in items:
        if kind.startswith("arrow"):
            color = {"arrow": MUTED, "arrow-link": LINK, "arrow-accent": ACCENT}[kind.split(":")[0]]
            dash = ' stroke-dasharray="5,4"' if kind.endswith(":dash") else ""
            out.append(f'<line x1="{x}" y1="{y+12}" x2="{x+32}" y2="{y+12}" stroke="{color}" stroke-width="1.2"{dash}/>')
        else:
            fill, stroke, _ = TREAT[kind]
            out.append(f'<rect x="{x}" y="{y+4}" width="32" height="16" rx="3" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        out.append(f'<text x="{x+40}" y="{y+16}" fill="{INK}" font-size="10" font-family="{SANS}">{text}</text>')
        x += 40 + len(text) * 6 + 32
    return "\n".join(out)


def page(slug, eyebrow, h1, lead, title, desc, body, vb_h=720):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{ --paper: {PAPER}; --ink: {INK}; --muted: {MUTED}; }}
body {{ font-family: {SANS}; background: var(--paper); color: var(--ink); min-height: 100vh;
  display: flex; align-items: center; justify-content: center; padding: 3rem 1rem; }}
.frame {{ max-width: 1280px; width: 100%; }}
.diagram-container {{ width: 100%; overflow-x: auto; }}
.eyebrow {{ font-family: {MONO}; font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 0.5rem; }}
h1 {{ font-family: {SERIF}; font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2.25rem); font-weight: 400;
  letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 0.5rem; }}
.lead {{ color: var(--muted); max-width: 60ch; margin-bottom: 1.5rem; line-height: 1.5; }}
svg {{ width: 100%; min-width: 1280px; display: block; }}
@media print {{ .diagram-container {{ overflow-x: visible; }} svg {{ min-width: 0; }} }}
</style>
</head>
<body>
<div class="frame">
<p class="eyebrow">{eyebrow}</p>
<h1>{h1}</h1>
<p class="lead">{lead}</p>
<div class="diagram-container">
<svg viewBox="0 0 1280 {vb_h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{slug}-title {slug}-desc">
<title id="{slug}-title">{title}</title>
<desc id="{slug}-desc">{desc}</desc>
<defs>
<marker id="{slug}-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>
<marker id="{slug}-arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{ACCENT}"/></marker>
<marker id="{slug}-arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{LINK}"/></marker>
</defs>
<rect width="100%" height="100%" fill="{PAPER}"/>
{body}
</svg>
</div>
</div>
</body>
</html>
"""


def arrow(d, slug, kind="arrow", dash=False, width=1.2):
    color = {"arrow": MUTED, "arrow-link": LINK, "arrow-accent": ACCENT}[kind]
    da = ' stroke-dasharray="5,4"' if dash else ""
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{da} marker-end="url(#{slug}-{kind})"/>'


# ---------------------------------------------------------------- 1. runtime
s = "runtime"
body = []
body.append(zone(248, 108, 608, 432, "ONE REPO · INTERNET ZONE"))
body.append(zone(896, 404, 328, 232, "OUTSIDE THE REPO"))
# arrows first
body.append(arrow("M200,352 H278", s, "arrow-accent"))
body.append(label(240, 330, "OPENS", ACCENT))
body.append(arrow("M346,316 V214", s))
body.append(label_left(354, 256, "READS FIRST"))
body.append(arrow("M480,334 H532 Q540,334 540,326 V240 Q540,232 548,232 H598", s))
body.append(arrow("M480,352 H598", s))
body.append(arrow("M480,370 H532 Q540,370 540,378 V464 Q540,472 548,472 H598", s))
body.append(arrow("M820,472 H918", s, "arrow-link"))
body.append(label(870, 450, "MOUNTS", LINK))
body.append(arrow("M413,388 V576 Q413,584 421,584 H918", s, "arrow-link"))
body.append(label(660, 562, "SIGN-IN COOKIE", LINK))
# nodes
body.append(node(40, 316, 160, 72, "input", "USER", "Browser", "citizen or staff"))
body.append(node(280, 140, 200, 72, "store", "FILE", "Remote list", "mfe-manifest.json"))
body.append(node(280, 316, 200, 72, "focal", "SHELL", "Portal shell", "header, menu, routes"))
body.append(node(600, 196, 220, 72, "backend", "REMOTE", "Services", "own build + deploy"))
body.append(node(600, 316, 220, 72, "private", "PRIVATE", "My profile", "after sign-in only"))
body.append(node(600, 436, 220, 72, "backend", "ADAPTER", "Payments", "hosts vendor code"))
body.append(node(920, 436, 200, 72, "external", "VENDOR", "Vendor module", "any framework"))
body.append(node(920, 548, 200, 72, "external", "BACKEND", "Sign-in service", "Singpass / staff SSO"))
body.append(f'<text x="600" y="84" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">Each remote is a small app, built and deployed on its own.</text>')
body.append(legend(668, [("focal", "Shell (main app)"), ("backend", "Remote (one team’s app)"), ("store", "Config file"),
                         ("external", "Not in this repo"), ("arrow", "Loads at runtime"), ("arrow-link", "Calls something outside")]))
(OUT / "1-runtime.html").write_text(page(
    s, "Architecture · How it runs", "How the portal works in the browser",
    "The shell is the main app. It reads a list of remotes, then loads each remote only when the user opens it.",
    "How the portal works in the browser",
    "The browser opens the portal shell, which reads the remote list and loads the Services, My profile and Payments remotes; Payments mounts an outside vendor module and the shell signs users in through the backend sign-in service.",
    "\n".join(body)))

# ---------------------------------------------------------------- 2. layers
s = "layers"
layers = [
    ("APPS", "Your apps: shells and remotes", "apps/intranet/* · apps/internet/*", False),
    ("PACKAGES", "Shared code every app reuses", "@org/ui · auth · mf-runtime · http-client", False),
    ("TOOLS", "Generators and safety checks", "pnpm gen:* · pnpm check · mock API", False),
    ("WORKSPACE", "One version list, one task runner", "pnpm catalog · Nx builds only what changed", False),
    ("DEPLOY", "One deploy setup for every app", "nginx.conf + Dockerfile · manifest per env", True),
]
body = []
x0, w, h, y = 200, 920, 88, 96
body.append(f'<text x="148" y="88" fill="{SOFT}" font-size="8" font-family="{MONO}" text-anchor="middle" letter-spacing="0.14em">USES</text>')
body.append(f'<line x1="148" y1="100" x2="148" y2="526" stroke="{MUTED}" stroke-width="1.2" marker-end="url(#{s}-arrow)"/>')
for i, (tag, name, sub, focal) in enumerate(layers):
    yy = y + i * h
    fill = ACCENT_TINT if focal else ("#ffffff" if i % 2 == 0 else "rgba(15,23,42,0.03)")
    stroke = ACCENT if focal else RULE
    body.append(f'<rect x="{x0}" y="{yy}" width="{w}" height="{h}" fill="{PAPER}"/>')
    body.append(f'<rect x="{x0}" y="{yy}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{1.2 if focal else 0.8}"/>')
    body.append(f'<text x="{x0+24}" y="{yy+h/2+3}" fill="{ACCENT if focal else SOFT}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">{tag}</text>')
    body.append(f'<text x="{x0+140}" y="{yy+h/2+6}" fill="{INK}" font-size="16" font-weight="600" font-family="{SANS}">{name}</text>')
    body.append(f'<text x="{x0+w-24}" y="{yy+h/2+5}" fill="{MUTED}" font-size="12" font-family="{MONO}" text-anchor="end">{sub}</text>')
body.append(f'<rect x="{x0}" y="{y}" width="{w}" height="{h*5}" fill="none" stroke="{MUTED}" stroke-width="1"/>')
body.append(f'<text x="640" y="600" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}" text-anchor="middle">Change nginx once, in deploy/, and every app picks it up on its next build.</text>')
(OUT / "2-layers.html").write_text(page(
    s, "Layer stack · What is inside", "What is inside the monorepo",
    "Five layers. Each layer uses the ones below it. Apps sit on top; one shared deploy setup sits at the bottom.",
    "What is inside the monorepo",
    "Layer stack of the monorepo: apps use shared packages, which use tools and safety checks, which run on one workspace with one version list and task runner, with one shared deploy setup at the bottom.",
    "\n".join(body), vb_h=640))

# ---------------------------------------------------------------- 3. new project
s = "newproject"
body = []
body.append(zone(24, 248, 252, 352, "TEMPLATE REPO"))
body.append(zone(344, 248, 812, 352, "YOUR PROJECT REPO (NEW FOLDER)"))
body.append(arrow("M260,320 H358", s, "arrow-accent"))
body.append(label(309, 298, "COPY ONCE", ACCENT))
body.append(arrow("M580,320 H658", s))
body.append(arrow("M860,320 H938", s))
body.append(arrow("M1040,360 V478", s))
body.append(label_left(1048, 412, "GIT PUSH"))
body.append(arrow("M150,360 V412 Q150,420 158,420 H462 Q470,420 470,412 V362", s, "arrow-link", dash=True, width=1))
body.append(label(310, 428, "PULL UPDATES", LINK))
body.append(node(40, 280, 220, 80, "external", "GITHUB", "mfe-monorepo-template", "starting point"))
body.append(node(360, 280, 220, 80, "focal", "STEP 1", "my-portal", "own folder + history"))
body.append(node(660, 280, 200, 80, "backend", "STEP 2", "Create apps", "pnpm gen:shell / remote"))
body.append(node(940, 280, 200, 80, "backend", "STEP 3", "Run and test", "pnpm dev · pnpm e2e"))
body.append(node(940, 480, 200, 80, "backend", "STEP 4", "Azure pipeline", "builds changed apps"))
body.append(f'<text x="40" y="176" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">The template and your project are two separate repos.</text>')
body.append(f'<text x="40" y="196" fill="{MUTED}" font-size="14" font-style="italic" font-family="{SERIF}">They do not need to sit in the same folder.</text>')
body.append(legend(668, [("focal", "Your new project"), ("external", "The template (kept as is)"), ("arrow", "Steps you do"),
                         ("arrow-link:dash", "Optional: pull template fixes later")]))
(OUT / "3-new-project.html").write_text(page(
    s, "Flow · Getting started", "Starting a new project from the template",
    "Copy the template once into a new repo. From then on it is your project: add apps, run them, push. You can still pull template fixes later if you want.",
    "Starting a new project from the template",
    "The template repo is copied once into a new project repo in its own folder; there you create apps, run and test them, and push to the Azure pipeline, with an optional path to pull later template fixes.",
    '<g transform="translate(0,-112)">' + "\n".join(body) + '</g>', vb_h=608))

# ---------------------------------------------------------------- SVG extract
# The .svg is the page's <svg> element as-is, plus width="1280" so it has a size on its own.
for name in ("1-runtime", "2-layers", "3-new-project"):
    html = (OUT / f"{name}.html").read_text()
    svg = html[html.index("<svg "):html.index("</svg>") + len("</svg>")]
    (OUT / f"{name}.svg").write_text(svg.replace("<svg ", '<svg width="1280" ', 1))

print("ok")

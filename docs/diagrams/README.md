# Diagrams

Three architecture diagrams in plain language, for developers and non-developers alike.

| Diagram                                                                                  | What it shows                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [1-runtime](1-runtime.html) ([png](1-runtime.png), [svg](1-runtime.svg))                 | How the portal works in the browser: the shell reads the remote list, loads each remote, mounts vendor code and signs users in. |
| [2-layers](2-layers.html) ([png](2-layers.png), [svg](2-layers.svg))                     | What is inside the monorepo: apps on top of shared packages, tools and checks, one workspace and one deploy setup.              |
| [3-new-project](3-new-project.html) ([png](3-new-project.png), [svg](3-new-project.svg)) | How a new project starts: copy the template once into your own repo, then create apps, run, test and push.                      |

Used in [architecture.md](../architecture.md) (1, 2) and [getting-started.md](../getting-started.md) (3).

## Which file to use

- **PNG** (2x, 2560 px wide): slides, wikis, chat, anything that only takes images.
- **SVG**: docs that render SVG (sharp at any size). Fonts fall back to system fonts if Geist is
  not installed.
- **HTML**: open in a browser to view standalone, with title and short intro (loads Geist from
  Google Fonts).

## Regenerate

The source is [source/diagrams.py](source/diagrams.py) (plain Python 3, no dependencies). Edit it,
then run from the repository root:

```sh
python3 docs/diagrams/source/diagrams.py docs/diagrams   # writes the .html and .svg files
node docs/diagrams/source/shoot.cjs                       # writes the .png files (2x)
```

`shoot.cjs` uses the repo's own Playwright (`@playwright/test`, a devDependency of
`packages/platform/playwright-config`), so run `pnpm install` first. If Chromium is missing:
`pnpm --filter @org/playwright-config exec playwright install chromium`. Both scripts take
optional directories (`shoot.cjs [html-dir] [png-dir]`) if you want to write somewhere else.

The generator is deterministic: rerunning it on unchanged source produces byte-identical HTML
and SVG.

## Credits

Drawn with the [diagram-design](https://github.com/cathrynlavery/diagram-design) method
(one focal element, typed nodes, labelled arrows, a legend). The palette comes from
`@org/design-tokens` (light theme: `--color-bg` paper, `--color-accent` teal), so the diagrams match the UI.

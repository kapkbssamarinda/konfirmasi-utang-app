# Graph Report - konfirmasi-utang-app  (2026-08-28)

## Corpus Check
- Corpus is ~12,328 words - fits in a single context window. You may not need a graph.

## Summary
- 72 nodes · 65 edges · 30 communities (5 shown, 25 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Package Scripts & Configuration
- Core Application UI & Components
- Document & React Core Dependencies
- ESLint JavaScript Config
- ESLint Tooling
- React Hooks Linting
- React Refresh Linting
- File Saver Utility
- FormKit Auto Animate
- Framer Motion Animations
- Globals Configuration
- JSZip Utility
- Lucide Icons
- Motion Library
- PizZip Docx Utility
- React Confetti Visuals
- React DOM Runtime
- React Use Hooks
- Excel XLSX Parser
- React Type Definitions
- React DOM Type Definitions
- Vite Bundler
- Vite React Plugin
- Build Setup & Vite Documentation
- Hero Banner Asset
- App Main Logo
- App Transparent Logo
- React Logo Asset
- Vite Logo Asset

## God Nodes (most connected - your core abstractions)
1. `scripts` - 5 edges
2. `App()` - 3 edges
3. `@formkit/auto-animate` - 2 edges
4. `docxtemplater` - 2 edges
5. `file-saver` - 2 edges
6. `framer-motion` - 2 edges
7. `jszip` - 2 edges
8. `lucide-react` - 2 edges
9. `motion` - 2 edges
10. `pizzip` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Single Page App Entrypoint (index.html)` --references--> `App Favicon`  [EXTRACTED]
  index.html → public/favicon.svg

## Import Cycles
- None detected.

## Communities (30 total, 25 thin omitted)

### Community 0 - "Package Scripts & Configuration"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 1 - "Core Application UI & Components"
Cohesion: 0.32
Nodes (6): Single Page App Entrypoint (index.html), App Favicon, SVG Icon Sprites / Definitions, App(), formatTanggalIndonesia(), Icons

### Community 2 - "Document & React Core Dependencies"
Cohesion: 0.40
Nodes (5): docxtemplater, dependencies, docxtemplater, react, react

### Community 3 - "ESLint JavaScript Config"
Cohesion: 0.67
Nodes (3): @eslint/js, devDependencies, @eslint/js

## Knowledge Gaps
- **39 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Document & React Core Dependencies` to `Package Scripts & Configuration`, `File Saver Utility`, `FormKit Auto Animate`, `Framer Motion Animations`, `JSZip Utility`, `Lucide Icons`, `Motion Library`, `PizZip Docx Utility`, `React Confetti Visuals`, `React DOM Runtime`, `React Use Hooks`, `Excel XLSX Parser`?**
  _High betweenness centrality (0.429) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `ESLint JavaScript Config` to `Package Scripts & Configuration`, `ESLint Tooling`, `React Hooks Linting`, `React Refresh Linting`, `Globals Configuration`, `React Type Definitions`, `React DOM Type Definitions`, `Vite Bundler`, `Vite React Plugin`?**
  _High betweenness centrality (0.326) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
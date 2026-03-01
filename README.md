# ralph-mayor-plugin

A production-ready planning plugin that turns vague build requests into executable, incremental implementation plans.

`ralph-mayor-plugin` performs a **Rig Scan** of a repository, generates atomic implementation beads, and compiles everything into `RALPH_PLAN.md` for immediate execution with `ralphex`.

---

## Why this exists

Most coding requests fail for one of two reasons:

- scope is too broad
- implementation starts before architecture reality is understood

`ralphify` fixes that by forcing a deterministic planning sequence:

1. scan the rig (stack, entry points, test posture)
2. break work into atomic beads
3. compile a handoff-ready plan

---

## Gastown Architecture

The plugin follows a simple three-stage pipeline ("Gastown" flow):

1. **Rig Scan**
   - detects stack(s): Node.js, Python, Go
   - infers package manager and probable entry points
   - detects available test frameworks
   - writes machine-readable output to `.ralph/rig-scan.json`

2. **Bead Generation**
   - generates atomic planning beads under `.ralph/beads/`
   - each bead is a constrained implementation phase
   - each bead is intentionally micro-step friendly (<50 lines/step guidance)

3. **RalphEx Compilation**
   - compiles scan + beads into `RALPH_PLAN.md`
   - includes execution notes for deterministic handoff
   - emits final action cue for execution

### Data Flow

```text
Goal text
  -> scripts/ralphify
  -> scripts/ralphify.js
      -> Rig Scan (.ralph/rig-scan.json)
      -> Bead files (.ralph/beads/bead-*.md)
      -> Compiled plan (RALPH_PLAN.md)
  -> "Plan generated. Run 'ralphex RALPH_PLAN.md' to sling the first bead."
```

---

## Rig Scan Details

Rig Scan is conservative by design. It prefers useful certainty over speculative guessing.

### What it detects

- **Node.js**
  - `package.json`
  - package manager (`npm`, `yarn`, `pnpm`)
  - entry points from `main`, `bin`, and common file names
  - test frameworks from dependencies/scripts

- **Python**
  - `requirements.txt`, `pyproject.toml`, `setup.py`
  - package manager hint (`pip` / `poetry`)
  - likely entry points
  - test tooling mentions (`pytest`, `tox`, etc.)

- **Go**
  - `go.mod`, `.go` files
  - `main.go` entry points
  - `_test.go` presence

### Output contract

Rig Scan always writes:

- `.ralph/rig-scan.json`

with top-level fields:

- `projectRoot`
- `detectedAt`
- `stacks[]`
- `hasTests`
- `primaryStack`

---

## `/ralphify` Usage

### CLI (local)

From the repo root:

```bash
./scripts/ralphify "Build a login endpoint with tests"
```

or:

```bash
node ./scripts/ralphify.js "Build a login endpoint with tests"
```

### Slash-command style workflow

In chat-integrated environments, `/ralphify` should pass the user goal verbatim to this script.

Example intent:

```text
/ralphify Build password reset flow with rate limiting and integration tests
```

Expected generated assets:

- `.ralph/rig-scan.json`
- `.ralph/beads/bead-001.md` ... `bead-00N.md`
- `RALPH_PLAN.md`

Final stdout:

```text
Plan generated. Run 'ralphex RALPH_PLAN.md' to sling the first bead.
```

---

## Repository Structure

```text
.
├── README.md
├── LICENSE
├── RALPH_PLAN.md
├── .ralph/
│   ├── rig-scan.json
│   └── beads/
└── scripts/
    ├── ralphify
    └── ralphify.js
```

---

## Script Contracts

### `scripts/ralphify`

- bash launcher
- resolves script-relative path safely
- delegates to `node scripts/ralphify.js`

### `scripts/ralphify.js`

- Node.js executable with shebang
- single required input: `<goal>`
- exits non-zero with usage when no goal is provided

---

## Development Notes

- Keep bead templates concise and implementation-focused.
- Prefer deterministic file output over implicit state.
- If adding new stack detectors, keep Rig Scan additive and non-breaking.

---

## License

MIT — see [LICENSE](./LICENSE).

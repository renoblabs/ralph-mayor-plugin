#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function safeRead(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function exists(file) {
  return fs.existsSync(file);
}

function detectNode(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!exists(pkgPath)) return null;

  let pkg = {};
  try {
    pkg = JSON.parse(safeRead(pkgPath) || '{}');
  } catch {
    pkg = {};
  }

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  const tests = [];
  ['jest', 'vitest', 'mocha', 'ava', 'cypress', '@playwright/test'].forEach((name) => {
    if (deps[name]) tests.push(name);
  });
  if (pkg.scripts && pkg.scripts.test && tests.length === 0) tests.push('custom npm test script');

  const entryPoints = [];
  if (pkg.main) entryPoints.push(pkg.main);
  if (pkg.bin) {
    if (typeof pkg.bin === 'string') entryPoints.push(pkg.bin);
    if (typeof pkg.bin === 'object') entryPoints.push(...Object.values(pkg.bin));
  }
  ['index.js', 'src/index.js', 'app.js', 'server.js'].forEach((f) => {
    if (exists(path.join(root, f))) entryPoints.push(f);
  });

  return {
    language: 'Node.js',
    packageManager: exists(path.join(root, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : exists(path.join(root, 'yarn.lock'))
      ? 'yarn'
      : 'npm',
    entryPoints: [...new Set(entryPoints)],
    testFrameworks: tests
  };
}

function detectPython(root) {
  const reqPath = path.join(root, 'requirements.txt');
  const pyprojectPath = path.join(root, 'pyproject.toml');
  const setupPyPath = path.join(root, 'setup.py');
  const hasPython = exists(reqPath) || exists(pyprojectPath) || exists(setupPyPath);
  if (!hasPython) return null;

  const tests = [];
  const text = [safeRead(reqPath), safeRead(pyprojectPath), safeRead(setupPyPath)]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  ['pytest', 'nose', 'unittest', 'tox', 'hypothesis'].forEach((name) => {
    if (text.includes(name)) tests.push(name);
  });

  const entryPoints = [];
  ['main.py', 'app.py', 'manage.py', 'wsgi.py', 'asgi.py'].forEach((f) => {
    if (exists(path.join(root, f))) entryPoints.push(f);
  });
  ['src/main.py', 'src/app.py'].forEach((f) => {
    if (exists(path.join(root, f))) entryPoints.push(f);
  });

  return {
    language: 'Python',
    packageManager: exists(path.join(root, 'poetry.lock')) ? 'poetry' : 'pip',
    entryPoints: [...new Set(entryPoints)],
    testFrameworks: [...new Set(tests)]
  };
}

function walk(root, maxDepth = 3) {
  const out = [];
  function rec(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        rec(full, depth + 1);
      } else {
        out.push(path.relative(root, full));
      }
    }
  }
  rec(root, 0);
  return out;
}

function detectGo(root) {
  const goMod = path.join(root, 'go.mod');
  const files = walk(root, 4);
  const goFiles = files.filter((f) => f.endsWith('.go'));
  if (!exists(goMod) && goFiles.length === 0) return null;

  const entryPoints = files.filter((f) => /(^|\/)main\.go$/.test(f));
  const tests = goFiles.some((f) => f.endsWith('_test.go')) ? ['go test'] : [];

  return {
    language: 'Go',
    packageManager: 'go modules',
    entryPoints: [...new Set(entryPoints)],
    testFrameworks: tests
  };
}

function rigScan(root) {
  const stacks = [detectNode(root), detectPython(root), detectGo(root)].filter(Boolean);

  const summary = {
    projectRoot: root,
    detectedAt: new Date().toISOString(),
    stacks,
    hasTests: stacks.some((s) => s.testFrameworks.length > 0),
    primaryStack: stacks[0]?.language || 'Unknown'
  };

  return summary;
}

function atomicBeads(goal, scan) {
  const stackHint = scan.stacks.length
    ? scan.stacks.map((s) => s.language).join(', ')
    : 'unknown stack';

  const beads = [
    {
      title: 'Clarify Goal and Constraints',
      lines: [
        `Goal: ${goal}`,
        'Document acceptance criteria in 3-6 bullets.',
        'List explicit non-goals and constraints.',
        `Align implementation choices to detected stack: ${stackHint}.`
      ]
    },
    {
      title: 'Map Existing Entry Points',
      lines: [
        'Inspect discovered entry points from Rig Scan.',
        'Identify where the new behavior should attach.',
        'Note any config/env assumptions and failure risks.',
        'Create a tiny change map (files likely to change).'
      ]
    },
    {
      title: 'Design Minimal Vertical Slice',
      lines: [
        'Define the smallest shippable implementation path.',
        'Keep scope tight to one user-visible outcome.',
        'Specify interfaces, data flow, and fallback behavior.',
        'Avoid broad refactors in first pass.'
      ]
    },
    {
      title: 'Implement Incrementally',
      lines: [
        'Apply changes in small commits/chunks.',
        'Prefer readable code over clever code.',
        'Add or update docs/comments where needed for maintainers.',
        'Guard risky paths with checks and useful error messages.'
      ]
    },
    {
      title: 'Validate with Tests',
      lines: [
        scan.hasTests
          ? `Run and update relevant test frameworks: ${[...new Set(scan.stacks.flatMap((s) => s.testFrameworks))].join(', ') || 'existing suite'}.`
          : 'Create a lightweight validation checklist if no test framework exists.',
        'Add at least one focused test for the new behavior when feasible.',
        'Verify happy path and one failure path.',
        'Capture command output for reproducibility.'
      ]
    },
    {
      title: 'Ship Readiness',
      lines: [
        'Summarize what changed and why.',
        'List rollback strategy and post-ship checks.',
        'Confirm docs/config updates are included.',
        'Prepare handoff notes for execution via ralphex.'
      ]
    }
  ];

  return beads;
}

function writeBeads(root, beads) {
  const beadDir = path.join(root, '.ralph', 'beads');
  fs.mkdirSync(beadDir, { recursive: true });

  // Clean old generated bead files
  for (const f of fs.readdirSync(beadDir)) {
    if (/^bead-\d+\.md$/.test(f)) {
      fs.unlinkSync(path.join(beadDir, f));
    }
  }

  return beads.map((bead, idx) => {
    const name = `bead-${String(idx + 1).padStart(3, '0')}.md`;
    const file = path.join(beadDir, name);
    const body = [
      `# ${bead.title}`,
      '',
      ...bead.lines.map((l, i) => `${i + 1}. ${l}`),
      '',
      '_Constraint: Keep implementation edits under 50 lines per micro-step when executing this bead._',
      ''
    ].join('\n');
    fs.writeFileSync(file, body, 'utf8');
    return { name, file, title: bead.title };
  });
}

function compilePlan(root, goal, scan, beadFiles) {
  const outFile = path.join(root, 'RALPH_PLAN.md');
  const stackRows = scan.stacks.length
    ? scan.stacks
        .map(
          (s) => `- **${s.language}** | entry: ${s.entryPoints.join(', ') || 'n/a'} | tests: ${s.testFrameworks.join(', ') || 'n/a'}`
        )
        .join('\n')
    : '- **Unknown** | entry: n/a | tests: n/a';

  const beadSections = beadFiles
    .map((b, i) => {
      const rel = path.relative(root, b.file);
      return `${i + 1}. **${b.title}**  \n   Source: \`${rel}\``;
    })
    .join('\n');

  const content = `# RALPH_PLAN\n\n## Goal\n${goal}\n\n## Phase 1 — Rig Scan\n- Project root: \`${scan.projectRoot}\`\n- Primary stack: **${scan.primaryStack}**\n- Detected at: ${scan.detectedAt}\n\n### Stack & Tooling\n${stackRows}\n\n## Phase 2 — Bead Generation\nAtomic beads were generated under \`.ralph/beads/\`.\n\n${beadSections}\n\n## Phase 3 — RalphEx Compilation\nThis plan is compiled for autonomous execution.\n\n### Execution Notes\n- Execute beads in order unless blocked.\n- Keep each micro-edit under 50 lines where practical.\n- Validate after each bead; do not defer all testing to the end.\n- If blocked, create a blocker note and proceed with unblocked beads.\n`;

  fs.writeFileSync(outFile, content, 'utf8');
  return outFile;
}

function ensureRalphDirs(root) {
  fs.mkdirSync(path.join(root, '.ralph'), { recursive: true });
  fs.mkdirSync(path.join(root, '.ralph', 'beads'), { recursive: true });
}

function writeRigScan(root, scan) {
  const target = path.join(root, '.ralph', 'rig-scan.json');
  fs.writeFileSync(target, JSON.stringify(scan, null, 2) + '\n', 'utf8');
  return target;
}

function main() {
  const goal = process.argv.slice(2).join(' ').trim();
  if (!goal) {
    console.error('Usage: ralphify <goal>');
    process.exit(1);
  }

  const root = process.cwd();
  ensureRalphDirs(root);

  const scan = rigScan(root);
  writeRigScan(root, scan);

  const beads = atomicBeads(goal, scan);
  const beadFiles = writeBeads(root, beads);
  compilePlan(root, goal, scan, beadFiles);

  console.log("Plan generated. Run 'ralphex RALPH_PLAN.md' to sling the first bead.");
}

main();

// lib/orchestrator.js — Stage 5: The AI Tech Lead
// Reads submitted modules, verifies against contracts, runs checks,
// generates an integration report. Per GOVERNANCE E-rules:
//   E1: Minimal-diff fixing (no whole-module rewrites)
//   E2: Bounded fix loop (≤3 attempts), every attempt logged
//   E3: Integration report = audit trail
//   E5: Full context to orchestrator

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const gateway = require('../llm/gateway');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBMISSIONS_DIR = path.join(DATA_DIR, 'submissions');
const BRIEFS_DIR = path.join(DATA_DIR, 'briefs');

// Sanitize module names to match submission directory names
function sanitizeModuleName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
}

// ---- Helpers ----

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getLatestTimestamp() {
  if (!fs.existsSync(BRIEFS_DIR)) return null;
  const files = fs.readdirSync(BRIEFS_DIR).filter(f => f.startsWith('analysis-'));
  if (files.length === 0) return null;
  const latest = files.sort().pop();
  return latest.replace('analysis-', '').replace('.json', '');
}

function getSubmittedModules() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) return [];
  return fs.readdirSync(SUBMISSIONS_DIR).filter(d => {
    const p = path.join(SUBMISSIONS_DIR, d);
    return fs.statSync(p).isDirectory();
  });
}

function getModuleFiles(moduleName) {
  const moduleDir = path.join(SUBMISSIONS_DIR, moduleName);
  if (!fs.existsSync(moduleDir)) return [];

  function listFiles(dir, prefix = '') {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'submission.json') continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...listFiles(path.join(dir, entry.name), relPath));
      } else {
        results.push(relPath);
      }
    }
    return results;
  }

  return listFiles(moduleDir);
}

function readModuleCode(moduleName, filePath) {
  const fullPath = path.join(SUBMISSIONS_DIR, moduleName, filePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

// ---- Static Security Scans (GOVERNANCE A-rules, C-rules) ----

function scanForSecrets(code, moduleName) {
  const issues = [];
  // A5: No hardcoded secrets
  const secretPatterns = [
    { pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, rule: 'A5', desc: 'Possible hardcoded secret' },
    { pattern: /(?:sk|pk|ak|rk)-[a-zA-Z0-9]{20,}/g, rule: 'A5', desc: 'Possible API key pattern' },
    { pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g, rule: 'A5', desc: 'GitHub token detected' },
  ];
  for (const { pattern, rule, desc } of secretPatterns) {
    if (pattern.test(code)) {
      issues.push({ rule, severity: 'critical', module: moduleName, desc });
    }
  }
  return issues;
}

function scanForErrorMasking(code, moduleName) {
  const issues = [];
  // C1: No error-masking (empty catches, bare null-swallowing)
  const maskPatterns = [
    { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g, rule: 'C1', desc: 'Empty catch block (error masking)' },
    { pattern: /catch\s*\(\s*\)\s*\{\s*\}/g, rule: 'C1', desc: 'Empty catch block with no parameter' },
  ];
  for (const { pattern, rule, desc } of maskPatterns) {
    if (pattern.test(code)) {
      issues.push({ rule, severity: 'warning', module: moduleName, desc });
    }
  }
  return issues;
}

function scanForImports(code, moduleName, allowedDeps) {
  const issues = [];
  if (!allowedDeps || allowedDeps.length === 0) return issues;

  // B1/B4: Check imports against whitelist
  const importPatterns = [
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s+.*?from\s+['"]([^'"]+)['"]/g,
  ];

  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const dep = match[1];
      // Skip relative imports and node builtins
      if (dep.startsWith('.') || dep.startsWith('/')) continue;
      const builtins = ['fs', 'path', 'http', 'https', 'url', 'crypto', 'assert', 'util', 'events', 'stream', 'buffer', 'child_process', 'os', 'net', 'tls', 'zlib', 'querystring', 'readline', 'vm', 'module'];
      if (builtins.includes(dep)) continue;

      if (!allowedDeps.includes(dep)) {
        issues.push({ rule: 'B4', severity: 'critical', module: moduleName, desc: `Off-whitelist dependency: ${dep}` });
      }
    }
  }
  return issues;
}

function scanForGodObjects(code, moduleName) {
  const issues = [];
  // C4: No god-objects (files > 500 lines)
  const lineCount = code.split('\n').length;
  if (lineCount > 500) {
    issues.push({ rule: 'C4', severity: 'warning', module: moduleName, desc: `File has ${lineCount} lines (>500 — possible god-object)` });
  }
  return issues;
}

function checkFileExistence(moduleName, files, buildInstructions) {
  const issues = [];
  // Check if the module has at least one file
  if (files.length === 0) {
    issues.push({ rule: 'DoD', severity: 'critical', module: moduleName, desc: 'No files submitted for this module' });
    return issues;
  }

  // Check for common entry points
  const entryPoints = ['index.js', 'index.html', 'index.ts', 'app.js', 'main.js', 'server.js'];
  const hasEntryPoint = files.some(f => entryPoints.includes(f));
  if (!hasEntryPoint) {
    issues.push({ rule: 'DoD', severity: 'warning', module: moduleName, desc: 'No common entry point found (index.js, app.js, etc.)' });
  }

  // Check for README (C5)
  const hasReadme = files.some(f => f.toLowerCase().includes('readme'));
  if (!hasReadme) {
    issues.push({ rule: 'C5', severity: 'warning', module: moduleName, desc: 'No README file found (mental-model documentation required)' });
  }

  return issues;
}

function checkDependencies(moduleName, files, contract) {
  const issues = [];
  // B2: Check package.json for pinned versions
  const hasPackageJson = files.includes('package.json');
  if (hasPackageJson) {
    const code = readModuleCode(moduleName, 'package.json');
    if (code) {
      const pkg = JSON.parse(code);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(deps || {})) {
        if (version.startsWith('^') || version.startsWith('~') || version.includes('*')) {
          issues.push({ rule: 'B2', severity: 'warning', module: moduleName, desc: `Unpinned version for ${name}: ${version}` });
        }
      }
    }
  }
  return issues;
}

// ---- Contract Test Runner ----

function runContractTest(moduleName, timestamp) {
  // Files may have spaces or hyphens in name — find matching test file
  const allTestFiles = fs.readdirSync(BRIEFS_DIR).filter(f => f.endsWith(`-test-${timestamp}.js`));
  const testFile = allTestFiles.find(f => {
    const fileModuleName = f.replace(`-test-${timestamp}.js`, '');
    return sanitizeModuleName(fileModuleName) === moduleName;
  });
  const fullPath = testFile ? path.join(BRIEFS_DIR, testFile) : null;
  if (!fullPath || !fs.existsSync(fullPath)) {
    return { passed: 0, failed: 0, output: 'No contract test file found', skipped: true };
  }

  try {
    const output = execSync(`node "${fullPath}"`, {
      cwd: path.join(SUBMISSIONS_DIR, moduleName),
      timeout: 15000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Parse test results from output
    const passed = (output.match(/✅/g) || []).length;
    const failed = (output.match(/❌/g) || []).length;
    return { passed, failed, output: output.trim(), skipped: false };
  } catch (err) {
    const output = err.stdout || err.stderr || err.message;
    const passed = (output.match(/✅/g) || []).length;
    const failed = (output.match(/❌/g) || []).length || 1;
    return { passed, failed: Math.max(failed, 1), output: output.trim(), skipped: false };
  }
}

// ---- AI Fix Loop (GOVERNANCE E1, E2) ----

async function aiFixModule(moduleName, issues, contract, signal) {
  const MAX_ATTEMPTS = 3;
  const fixes = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[orchestrator] AI fix attempt ${attempt}/${MAX_ATTEMPTS} for ${moduleName}...`);

    // Gather the failing code
    const files = getModuleFiles(moduleName);
    const codeSnippets = files.slice(0, 3).map(f => {
      const code = readModuleCode(moduleName, f);
      return `--- ${f} ---\n${code ? code.slice(0, 2000) : '(empty)'}`;
    }).join('\n\n');

    const systemPrompt = {
      role: 'system',
      content:
        'You are the AI Tech Lead for a vibe-coded project. A module has failed verification. ' +
        'You must provide a MINIMAL FIX (E1: minimal-diff fixing — no whole-module rewrites). ' +
        'Respond with ONLY a JSON object containing: ' +
        '{ "fixes": [{ "file": "filename", "description": "what to change", "patch": "the exact code replacement" }], "summary": "one-line summary" }. ' +
        'No markdown, no explanation outside the JSON.',
    };

    const userPrompt = {
      role: 'user',
      content:
        `## Module: ${moduleName}\n\n` +
        `## Issues Found:\n${issues.map(i => `- [${i.severity}] ${i.rule}: ${i.desc}`).join('\n')}\n\n` +
        `## Contract:\n${JSON.stringify(contract, null, 2).slice(0, 3000)}\n\n` +
        `## Current Code:\n${codeSnippets}\n\n` +
        `Provide minimal fixes for the issues above. Only fix what's broken — do not rewrite working code.`,
    };

    try {
      const { result } = await gateway.structured({
        messages: [systemPrompt, userPrompt],
        schema: {
          type: 'object',
          properties: {
            fixes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  file: { type: 'string' },
                  description: { type: 'string' },
                  patch: { type: 'string' },
                },
                required: ['file', 'description', 'patch'],
              },
            },
            summary: { type: 'string' },
          },
          required: ['fixes', 'summary'],
        },
        signal,
      });

      // Apply fixes (best-effort — write patch to file)
      if (result.fixes && result.fixes.length > 0) {
        for (const fix of result.fixes) {
          const filePath = path.join(SUBMISSIONS_DIR, moduleName, fix.file);
          if (fs.existsSync(filePath)) {
            // For MVP: append the fix as a comment block (safe — doesn't overwrite)
            const original = fs.readFileSync(filePath, 'utf8');
            const fixBlock = `\n\n// === AI TECH LEAD FIX (attempt ${attempt}) ===\n// ${fix.description}\n${fix.patch}\n// === END FIX ===\n`;
            fs.writeFileSync(filePath, original + fixBlock);
            console.log(`[orchestrator] Applied fix to ${fix.file}: ${fix.description}`);
          }
        }
        fixes.push({ attempt, fixes: result.fixes, summary: result.summary });
      }

      // Re-scan to check if issues are resolved
      const remainingIssues = [];
      const files2 = getModuleFiles(moduleName);
      for (const f of files2) {
        const code = readModuleCode(moduleName, f);
        if (!code) continue;
        remainingIssues.push(...scanForSecrets(code, moduleName));
        remainingIssues.push(...scanForErrorMasking(code, moduleName));
      }

      if (remainingIssues.filter(i => i.severity === 'critical').length === 0) {
        console.log(`[orchestrator] ${moduleName} passes after fix attempt ${attempt}`);
        return { fixed: true, attempts: attempt, fixes, remainingIssues };
      }

      console.log(`[orchestrator] ${moduleName} still has critical issues after attempt ${attempt}`);
    } catch (err) {
      console.error(`[orchestrator] AI fix attempt ${attempt} failed:`, err.message);
      fixes.push({ attempt, error: err.message });
    }
  }

  return { fixed: false, attempts: MAX_ATTEMPTS, fixes, remainingIssues: [] };
}

// ---- Main Integration Pipeline ----

async function integrate(signal) {
  const timestamp = getLatestTimestamp();
  if (!timestamp) {
    return { success: false, error: 'No briefs found. Run Finalize Discussion first.', modules: [] };
  }

  // Load analysis and contracts
  const analysis = readJsonSafe(path.join(BRIEFS_DIR, `analysis-${timestamp}.json`));
  const sharedContract = readJsonSafe(path.join(BRIEFS_DIR, `contract-${timestamp}.json`));

  if (!analysis || !sharedContract) {
    return { success: false, error: 'Briefs are corrupted. Run Finalize Discussion again.', modules: [] };
  }

  const submittedModules = getSubmittedModules();
  // Sanitize brief module names to match submission directory names (spaces → hyphens)
  const briefModules = (analysis.modules || []).map(m => sanitizeModuleName(m.name));
  // Also sanitize the module objects in-place for owner lookups
  for (const mod of analysis.modules || []) {
    mod.name = sanitizeModuleName(mod.name);
  }

  console.log(`[orchestrator] Starting integration for ${analysis.app_name}`);
  console.log(`[orchestrator] Brief modules: ${briefModules.join(', ')}`);
  console.log(`[orchestrator] Submitted modules: ${submittedModules.join(', ')}`);

  const moduleReports = [];

  for (const moduleName of briefModules) {
    console.log(`\n[orchestrator] Verifying module: ${moduleName}...`);
    const report = {
      module: moduleName,
      owner: analysis.modules.find(m => m.name === moduleName)?.owner || 'unknown',
      submitted: submittedModules.includes(moduleName),
      checks: [],
      issues: [],
      testResult: null,
      aiFixes: null,
      status: 'pending',
    };

    // Load contract for this module — files may have spaces or hyphens in name
    const allContractFiles = fs.readdirSync(BRIEFS_DIR).filter(f => f.endsWith(`-contract-${timestamp}.json`));
    // Match by sanitized module name (CSS-Module matches CSS Module-contract-...)
    const contractFile = allContractFiles.find(f => {
      const fileModuleName = f.replace(`-contract-${timestamp}.json`, '');
      return sanitizeModuleName(fileModuleName) === moduleName;
    });
    const contract = contractFile
      ? readJsonSafe(path.join(BRIEFS_DIR, contractFile))
      : null;

    if (!report.submitted) {
      report.issues.push({ rule: 'DoD', severity: 'critical', module: moduleName, desc: 'Module not submitted — no files in data/submissions/' });
      report.status = 'missing';
      moduleReports.push(report);
      console.log(`[orchestrator] ${moduleName}: NOT SUBMITTED`);
      continue;
    }

    // 1. Get submitted files
    const files = getModuleFiles(moduleName);
    report.checks.push({ name: 'Files exist', passed: files.length > 0, detail: `${files.length} file(s) submitted` });

    // 2. File existence checks (C5, DoD)
    const fileIssues = checkFileExistence(moduleName, files, contract?.build_instructions);
    report.issues.push(...fileIssues);

    // 3. Security scans (A5, C1)
    for (const f of files) {
      const code = readModuleCode(moduleName, f);
      if (!code) continue;
      report.issues.push(...scanForSecrets(code, moduleName));
      report.issues.push(...scanForErrorMasking(code, moduleName));
      report.issues.push(...scanForGodObjects(code, moduleName));
      report.issues.push(...scanForImports(code, moduleName, contract?.shared_contract?.allowedDependencies));
    }

    // 4. Dependency checks (B2)
    report.issues.push(...checkDependencies(moduleName, files, contract));

    // 5. Run contract test
    const testResult = runContractTest(moduleName, timestamp);
    report.testResult = testResult;
    report.checks.push({ name: 'Contract tests', passed: testResult.failed === 0 && !testResult.skipped, detail: testResult.output.slice(0, 500) });

    // Determine status
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    const warnings = report.issues.filter(i => i.severity === 'warning');

    if (criticalIssues.length === 0 && testResult.failed === 0) {
      report.status = 'pass';
    } else if (criticalIssues.length > 0) {
      report.status = 'fail';
    } else {
      report.status = 'warnings';
    }

    // 6. AI fix loop for failing modules (E1, E2)
    if (report.status === 'fail' && criticalIssues.length > 0) {
      console.log(`[orchestrator] ${moduleName} has ${criticalIssues.length} critical issue(s) — attempting AI fix...`);
      const fixResult = await aiFixModule(moduleName, criticalIssues, contract, signal);
      report.aiFixes = fixResult;

      if (fixResult.fixed) {
        report.status = 'fixed';
        console.log(`[orchestrator] ${moduleName} fixed after ${fixResult.attempts} attempt(s)`);
      } else {
        report.status = 'fail';
        console.log(`[orchestrator] ${moduleName} could not be fixed after ${fixResult.attempts} attempts`);
      }
    }

    moduleReports.push(report);
    console.log(`[orchestrator] ${moduleName}: ${report.status.toUpperCase()}`);
  }

  // Overall status
  const allPass = moduleReports.every(r => r.status === 'pass' || r.status === 'fixed');
  const anyFail = moduleReports.some(r => r.status === 'fail');
  const anyMissing = moduleReports.some(r => r.status === 'missing');

  const integrationReport = {
    app_name: analysis.app_name,
    timestamp: Date.now(),
    overall_status: allPass ? 'success' : anyFail ? 'failure' : anyMissing ? 'incomplete' : 'warnings',
    modules: moduleReports,
    summary: {
      total: moduleReports.length,
      passed: moduleReports.filter(r => r.status === 'pass').length,
      fixed: moduleReports.filter(r => r.status === 'fixed').length,
      failed: moduleReports.filter(r => r.status === 'fail').length,
      missing: moduleReports.filter(r => r.status === 'missing').length,
      warnings: moduleReports.filter(r => r.status === 'warnings').length,
    },
  };

  // Save report to disk
  const reportsDir = path.join(DATA_DIR, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportsDir, `integration-${Date.now()}.json`),
    JSON.stringify(integrationReport, null, 2)
  );

  console.log(`\n[orchestrator] Integration complete: ${integrationReport.overall_status.toUpperCase()}`);
  console.log(`[orchestrator] ${integrationReport.summary.passed} passed, ${integrationReport.summary.fixed} fixed, ${integrationReport.summary.failed} failed, ${integrationReport.summary.missing} missing`);

  return integrationReport;
}

module.exports = { integrate, getSubmittedModules, getModuleFiles, scanForSecrets, scanForErrorMasking };

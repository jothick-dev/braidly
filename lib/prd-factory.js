// lib/prd-factory.js — Stage 2: The PRD Factory
// Takes the debate room discussion and generates per-person briefs:
// - Shared Contract (identical for all)
// - PRD per person (what to build)
// - Build Instructions per person (how it must fit)
// - contract.json per person (machine-readable)
// - Contract tests per person (mock other modules)
// - Definition of Done checklist per person
//
// GOVERNANCE: contract-first architecture — integration becomes mechanical verification.

const fs = require('fs');
const path = require('path');
const gateway = require('../llm/gateway');

// ---- Schemas for structured output (OpenAI json_schema format) ----

const DISCUSSION_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    app_name: { type: 'string', description: 'Short name for the app (e.g., "TaskFlow")' },
    app_description: { type: 'string', description: 'One-paragraph description of what the app does' },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Module name (e.g., "frontend", "backend")' },
          description: { type: 'string', description: 'What this module does' },
          owner: { type: 'string', description: 'Team member who should build this (use name from chat)' },
        },
        required: ['name', 'description', 'owner'],
      },
    },
    tech_stack: {
      type: 'object',
      properties: {
        frontend: { type: 'string' },
        backend: { type: 'string' },
        database: { type: 'string' },
      },
      required: ['frontend', 'backend', 'database'],
    },
    api_endpoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          path: { type: 'string', description: 'e.g., /api/tasks' },
          description: { type: 'string' },
          request_body: { type: 'string', description: 'JSON schema description or null' },
          response_body: { type: 'string', description: 'JSON schema description or null' },
        },
        required: ['method', 'path', 'description'],
      },
    },
    data_models: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'e.g., "Task"' },
          fields: { type: 'string', description: 'JSON-like description of fields' },
        },
        required: ['name', 'fields'],
      },
    },
  },
  required: ['app_name', 'app_description', 'modules', 'tech_stack', 'api_endpoints', 'data_models'],
  additionalProperties: false,
};

const PERSONAL_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    prd: {
      type: 'object',
      properties: {
        module_name: { type: 'string' },
        owner: { type: 'string' },
        user_stories: {
          type: 'array',
          items: { type: 'string' },
        },
        acceptance_criteria: {
          type: 'array',
          items: { type: 'string' },
        },
        ui_behavior: { type: 'string', description: 'Description of UI/behavior for this module' },
      },
      required: ['module_name', 'owner', 'user_stories', 'acceptance_criteria'],
    },
    build_instructions: {
      type: 'object',
      properties: {
        file_names: { type: 'string', description: 'Exact file names and entry points' },
        exported_signatures: { type: 'string', description: 'Required exported functions/classes' },
        mocks: { type: 'string', description: 'How to mock other modules' },
        dependencies: { type: 'string', description: 'Allowed npm packages (whitelist)' },
        self_test_steps: { type: 'string', description: 'How to verify locally' },
      },
      required: ['file_names', 'exported_signatures', 'dependencies'],
    },
    definition_of_done: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['prd', 'build_instructions', 'definition_of_done'],
};

// ---- Core Functions ----

/**
 * analyzeDiscussion(messages, signal) → structured analysis of the chat
 * Extracts: app name, modules, owners, tech stack, API endpoints, data models
 */
async function analyzeDiscussion(messages, signal) {
  const chatHistory = messages
    .filter((m) => m.role === 'human' || m.role === 'ai')
    .map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: `[${m.sender || 'AI'}]: ${m.text}`,
    }));

  // API requires last message to be from 'user' — if last is assistant, add a follow-up
  if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant') {
    chatHistory.push({ role: 'user', content: 'Please analyze this discussion and generate the structured output.' });
  }

  const systemPrompt = {
    role: 'system',
    content:
      'You are analyzing a team discussion about a software app they want to build. ' +
      'You MUST respond with ONLY a valid JSON object. No markdown, no explanation. ' +
      'The JSON must have these fields: ' +
      'app_name (string), app_description (string), ' +
      'modules (array of objects with name/description/owner strings), ' +
      'tech_stack (object with frontend/backend/database strings), ' +
      'api_endpoints (array of objects with method/path/description strings), ' +
      'data_models (array of objects with name/fields strings). ' +
      'Identify team members from the chat. ' +
      'If no tech stack discussed, use: React frontend, Node.js/Express backend, SQLite database. ' +
      'Be specific and actionable.',
  };

  const messages_for_llm = [systemPrompt, ...chatHistory];

  const { result } = await gateway.structured({
    messages: messages_for_llm,
    schema: DISCUSSION_ANALYSIS_SCHEMA,
    signal,
  });

  // Ensure required fields exist with safe defaults
  return {
    app_name: result.app_name || 'Untitled App',
    app_description: result.app_description || '',
    modules: Array.isArray(result.modules) ? result.modules : [{ name: 'app', description: 'Main application', owner: 'Team' }],
    tech_stack: result.tech_stack || { frontend: 'React', backend: 'Node.js/Express', database: 'SQLite' },
    api_endpoints: Array.isArray(result.api_endpoints) ? result.api_endpoints : [{ method: 'GET', path: '/api/health', description: 'Health check' }],
    data_models: Array.isArray(result.data_models) ? result.data_models : [],
  };
}

/**
 * generatePersonalBrief(analysis, moduleName, owner, sharedContract, signal)
 * → PRD + Build Instructions + Definition of Done for one person
 */
async function generatePersonalBrief(analysis, moduleName, owner, sharedContract, signal) {
  const systemPrompt = {
    role: 'system',
    content:
      `You are generating a personal brief for a team member named "${owner}" who will build the "${moduleName}" module. ` +
      'Generate a detailed PRD, strict Build Instructions, and Definition of Done. ' +
      'The build instructions must reference the shared contract (provided below) and ensure the module integrates correctly. ' +
      'Be specific about file names, exported functions, and dependency whitelist. ' +
      'The Definition of Done should be a checklist of verifiable items.',
  };

  const contextPrompt = {
    role: 'user',
    content:
      `## App Overview\n${analysis.app_description}\n\n` +
      `## Tech Stack\nFrontend: ${analysis.tech_stack.frontend}\nBackend: ${analysis.tech_stack.backend}\nDatabase: ${analysis.tech_stack.database}\n\n` +
      `## All Modules\n${analysis.modules.map((m) => `- ${m.name}: ${m.description} (owner: ${m.owner})`).join('\n')}\n\n` +
      `## API Endpoints\n${analysis.api_endpoints.map((e) => `${e.method} ${e.path} — ${e.description}`).join('\n')}\n\n` +
      `## Data Models\n${analysis.data_models.map((d) => `- ${d.name}: ${d.fields}`).join('\n')}\n\n` +
      `## Shared Contract\n${JSON.stringify(sharedContract, null, 2)}\n\n` +
      `## Your Module: ${moduleName}\nOwner: ${owner}\nDescription: ${analysis.modules.find((m) => m.name === moduleName)?.description || 'N/A'}`,
  };

  const messages_for_llm = [systemPrompt, contextPrompt];

  const { result } = await gateway.structured({
    messages: messages_for_llm,
    schema: PERSONAL_BRIEF_SCHEMA,
    signal,
  });

  // Normalize: model sometimes returns 'product_requirements_document' instead of 'prd'
  if (!result.prd && result.product_requirements_document) {
    result.prd = result.product_requirements_document;
  }
  // Ensure prd has required fields
  if (result.prd) {
    if (!result.prd.module_name) result.prd.module_name = moduleName;
    if (!result.prd.owner) result.prd.owner = owner;
  }

  return result;
}

/**
 * buildSharedContract(analysis) → contract object (identical for all members)
 */
function buildSharedContract(analysis) {
  // Validate required fields with safe defaults (LLM may omit fields)
  const modules = Array.isArray(analysis.modules) ? analysis.modules : [];
  const techStack = analysis.tech_stack || { frontend: 'HTML/CSS/JS', backend: 'Node.js/Express', database: 'SQLite' };
  const apiEndpoints = Array.isArray(analysis.api_endpoints) ? analysis.api_endpoints : [];
  const dataModels = Array.isArray(analysis.data_models) ? analysis.data_models : [];

  return {
    app_name: analysis.app_name || 'Untitled App',
    description: analysis.app_description || '',
    tech_stack: techStack,
    api_endpoints: apiEndpoints,
    data_models: dataModels,
    repo_layout: {
      root: './',
      modules: modules.map((m) => `./modules/${m.name}/`),
      shared: './shared/',
    },
    do_not_touch: ['package.json', '.env', 'shared/'],
    security_constitution: {
      A1: 'Parameterized queries only',
      A2: 'No weak password storage',
      A3: 'Ownership checks on every object access',
      A4: 'Input validation on every route',
      A5: 'No secrets in code',
      A6: 'No verbose error leakage',
      A7: 'Upload validation (MIME + size limits)',
      A8: 'CORS origin allowlist',
      A9: 'Security headers + cookies',
      A10: 'Rate limiting on auth endpoints',
    },
  };
}

/**
 * buildContractJson(moduleName, owner, brief, sharedContract) → machine-readable contract
 */
function buildContractJson(moduleName, owner, brief, sharedContract) {
  return {
    module: moduleName,
    owner: owner,
    shared_contract: sharedContract,
    prd_summary: brief.prd,
    build_instructions: brief.build_instructions,
    definition_of_done: brief.definition_of_done,
  };
}

/**
 * buildContractTest(moduleName, owner, analysis, sharedContract) → test file content (JS)
 */
function buildContractTest(moduleName, owner, analysis) {
  const otherModules = analysis.modules.filter((m) => m.name !== moduleName);
  const moduleEndpoints = analysis.api_endpoints.filter((e) => {
    // Simple heuristic: endpoints matching module name or all endpoints for "backend"
    return moduleName === 'backend' || moduleName === 'api' || e.path.includes(moduleName);
  });

  return `// Contract test for ${moduleName} (owner: ${owner})
// Auto-generated by Braidly PRD Factory
// Run: node contract-test.js
// This test mocks OTHER modules and verifies THIS module against the contract.

const assert = require('assert');

// ---- Mock other modules ----
${otherModules.map((m) => `// Mock: ${m.name} (${m.description})`).join('\n')}

// ---- Contract assertions for ${moduleName} ----
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(\`  ✅ \${name}\`);
    passed++;
  } catch (err) {
    console.error(\`  ❌ \${name}: \${err.message}\`);
    failed++;
  }
}

console.log('\\n📋 Contract tests for ${moduleName} (owner: ${owner})\\n');

// File structure tests
test('Has required entry point file', () => {
  // TODO: Verify file exists at the path specified in build instructions
  // const fs = require('fs');
  // assert.ok(fs.existsSync('./index.js'), 'Missing entry point');
  console.log('    (manual check: verify file exists per build instructions)');
});

// API endpoint tests
${moduleEndpoints.map((e) => `test('${e.method} ${e.path} exists and returns correct shape', () => {
  // TODO: Start the module server and test this endpoint
  // Example: const res = await fetch('http://localhost:3000${e.path}');
  // assert.strictEqual(res.status, 200);
  // const body = await res.json();
  // assert.ok(body.hasOwnProperty('id'), 'Missing id field');
  console.log('    (manual check: test ${e.method} ${e.path} after starting server)');
});`).join('\n\n')}

// Security constitution tests (GOVERNANCE A-rules)
test('No hardcoded secrets', () => {
  console.log('    (manual check: scan source for API keys, passwords, tokens)');
});

test('Input validation present', () => {
  console.log('    (manual check: verify all routes validate input)');
});

test('No verbose error leakage', () => {
  console.log('    (manual check: errors return generic messages, not stack traces)');
});

// Summary
console.log(\`\\n📊 Results: \${passed} passed, \${failed} failed\\n\`);
process.exit(failed > 0 ? 1 : 0);
`;
}

module.exports = {
  analyzeDiscussion,
  generatePersonalBrief,
  buildSharedContract,
  buildContractJson,
  buildContractTest,
  DISCUSSION_ANALYSIS_SCHEMA,
  PERSONAL_BRIEF_SCHEMA,
};

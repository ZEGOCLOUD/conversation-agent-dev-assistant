#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const DEFAULT_TEXT_PATH = '/voice/text-chat';
const DEFAULT_CALLBACK_PATH = '/voice-gateway/chat/completions';
const DEFAULT_CONTEXT_PATH = '/voice/control/sessions/:sessionId/context';
const DEFAULT_MODE_PATH = '/voice/control/sessions/:sessionId/mode';
const DEFAULT_ACTION_RESULT_PATH = '/voice/action-result';
const DEFAULT_AGENT_INSTANCES_PATH = '/voice/agent-instances';
const ACTION_RE = /\[ACTION:([^\]\s]+)([^\]]*)\]/g;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

main().catch(error => {
  console.error(`scenario-eval failed: ${error?.message || String(error)}`);
  if (process.env.SCENARIO_EVAL_DEBUG) console.error(error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.scenario) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const scenarioPath = path.resolve(args.scenario);
  const scenario = loadScenario(scenarioPath);
  const workspacePath = args.workspace
    ? path.resolve(args.workspace)
    : scenario.workspace?.path
      ? path.resolve(path.dirname(scenarioPath), scenario.workspace.path)
      : undefined;
  const workspace = inspectWorkspace(workspacePath);
  const validation = validateScenario(scenario, workspace);

  if (args.dryRun) {
    printDryRun({ scenario, scenarioPath, workspace, validation });
    process.exit(validation.errors.length ? 1 : 0);
  }

  if (validation.errors.length) {
    for (const error of validation.errors) console.error(`error: ${error}`);
    process.exit(1);
  }

  const mode = args.mock ? 'mock' : args.gatewayUrl ? 'gateway' : 'mock';
  if (mode === 'mock' && !args.mock) {
    console.warn('No --gateway-url supplied; using --mock mode so the local reporting path can run offline.');
  }

  const outDir = path.resolve(args.out || path.join(process.cwd(), '.scenario-eval-runs', timestampSlug()));
  fs.mkdirSync(outDir, { recursive: true });
  const run = await runScenario({
    scenario,
    scenarioPath,
    workspace,
    outDir,
    mode,
    args
  });

  writeReports(run, outDir);
  printRunSummary(run, outDir);

  if (run.summary.failedCases > 0 && args.failOnFindings) process.exit(1);
}

function printHelp() {
  console.log(`Conversation Agent local scenario evaluator ${VERSION}

Usage:
  node tools/scenario-eval.mjs --scenario <scenario.eval.yaml> [options]

Options:
  --workspace <path>       Customer workspace path. Defaults to scenario.workspace.path.
  --out <dir>              Output report directory.
  --dry-run                Validate scenario contract only; do not call a model or Gateway.
  --mock                   Run against scenario mockResponses instead of Gateway.
  --gateway-url <url>      Local Gateway base URL, for example http://127.0.0.1:18795.
  --workspace-id <id>      Optional Gateway workspaceId query/body value.
  --auth-token <token>     Optional Gateway HTTP auth token.
  --callback-token <token> Optional ZEGO callback auth token. Defaults to --auth-token.
  --transport <name>       text-chat (default) or zego-callback.
  --text-path <path>       Gateway text path. Default: ${DEFAULT_TEXT_PATH}
  --callback-path <path>   Gateway callback path. Default: ${DEFAULT_CALLBACK_PATH}
  --context-path <path>    Gateway context path. Default: ${DEFAULT_CONTEXT_PATH}
  --mode-path <path>       Gateway mode path. Default: ${DEFAULT_MODE_PATH}
  --action-result-path <path>
                           Gateway action result path. Default: ${DEFAULT_ACTION_RESULT_PATH}
  --case-limit <n>         Run only the first n cases.
  --persona-limit <n>      Run only the first n personas when cases do not pin a persona.
  --seed <value>           Deterministic seed label recorded in reports.
  --fail-on-findings       Exit non-zero when any case fails.
  --help                   Show this help.

Examples:
  node tools/scenario-eval.mjs \\
    --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \\
    --dry-run

  node tools/scenario-eval.mjs \\
    --scenario examples/scenario-eval/voice-room-demo/scenario.eval.yaml \\
    --mock --out .scenario-eval-runs/voice-room-demo

  node tools/scenario-eval.mjs \\
    --scenario ./scenario.eval.yaml \\
    --workspace ./pulse-project/workspaces/default \\
    --gateway-url http://127.0.0.1:18795 \\
    --auth-token "$CONVERSATION_AGENT_CONTROL_TOKEN"
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const [name, inlineValue] = raw.slice(2).split(/=(.*)/s).filter(Boolean);
    const next = argv[i + 1];
    const boolFlags = new Set(['dry-run', 'mock', 'help', 'fail-on-findings']);
    const key = camelCase(name);
    if (boolFlags.has(name)) {
      args[key] = true;
      continue;
    }
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    args[key] = next;
    i += 1;
  }
  if (args.caseLimit) args.caseLimit = Number(args.caseLimit);
  if (args.personaLimit) args.personaLimit = Number(args.personaLimit);
  return args;
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function loadScenario(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Scenario file not found: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) return JSON.parse(text);
  return parseSimpleYaml(text);
}

function validateScenario(scenario, workspace) {
  const errors = [];
  const warnings = [];
  if (!scenario || typeof scenario !== 'object') errors.push('scenario file must contain a mapping/object');
  if (!scenario.id) errors.push('missing top-level id');
  if (!scenario.scenario?.goal) errors.push('missing scenario.goal');
  if (!Array.isArray(scenario.personas) || scenario.personas.length === 0) errors.push('personas must contain at least one persona');
  if (!Array.isArray(scenario.cases) || scenario.cases.length === 0) errors.push('cases must contain at least one case');
  if (!Array.isArray(scenario.actions)) warnings.push('actions is empty; action checks will be limited to case expectations');
  if (!workspace.exists) warnings.push('workspace path was not found; workspace inspection will be skipped');

  const personaIds = new Set((scenario.personas || []).map(item => item.id).filter(Boolean));
  for (const persona of scenario.personas || []) {
    for (const field of ['id', 'goal', 'hiddenConcern', 'behaviorStyle', 'actionAcceptanceThreshold']) {
      if (!persona[field]) errors.push(`persona ${persona.id || '<unknown>'} missing ${field}`);
    }
  }
  for (const testCase of scenario.cases || []) {
    if (!testCase.id) errors.push('case missing id');
    if (!Array.isArray(testCase.turns) || testCase.turns.length === 0) errors.push(`case ${testCase.id || '<unknown>'} missing turns`);
    if (testCase.persona && !personaIds.has(testCase.persona)) errors.push(`case ${testCase.id} references unknown persona ${testCase.persona}`);
    if (!testCase.expect) warnings.push(`case ${testCase.id || '<unknown>'} has no expect block`);
  }
  return { errors, warnings };
}

function inspectWorkspace(workspacePath) {
  const result = {
    path: workspacePath || '',
    exists: Boolean(workspacePath && fs.existsSync(workspacePath)),
    files: {},
    modes: [],
    knowledgeFiles: [],
    skillFiles: [],
    actions: []
  };
  if (!result.exists) return result;

  for (const name of ['workspace.json', 'agent.md', 'AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md']) {
    const file = path.join(workspacePath, name);
    if (fs.existsSync(file)) {
      result.files[name] = {
        path: file,
        chars: fs.readFileSync(file, 'utf8').length
      };
    }
  }

  const modesDir = path.join(workspacePath, 'modes');
  if (fs.existsSync(modesDir)) {
    result.modes = fs.readdirSync(modesDir).filter(name => name.endsWith('.md')).sort();
  }
  const knowledgeDir = path.join(workspacePath, 'knowledge');
  if (fs.existsSync(knowledgeDir)) {
    result.knowledgeFiles = fs.readdirSync(knowledgeDir).sort();
  }
  const skillsDir = path.join(workspacePath, 'skills');
  if (fs.existsSync(skillsDir)) {
    result.skillFiles = walkFiles(skillsDir).filter(name => name.endsWith('SKILL.md')).sort();
  }

  const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
  if (fs.existsSync(workspaceJsonPath)) {
    try {
      const workspaceJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
      result.actions = Array.isArray(workspaceJson.actions)
        ? workspaceJson.actions
        : Array.isArray(workspaceJson?.runtime?.actions)
          ? workspaceJson.runtime.actions
          : [];
    } catch (error) {
      result.workspaceJsonError = error.message;
    }
  }
  return result;
}

function walkFiles(root) {
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const child of walkFiles(full)) output.push(path.join(entry.name, child));
    } else {
      output.push(entry.name);
    }
  }
  return output;
}

function printDryRun({ scenario, scenarioPath, workspace, validation }) {
  console.log(`# scenario-eval dry run`);
  console.log(`scenario: ${scenarioPath}`);
  console.log(`id: ${scenario.id || '<missing>'}`);
  console.log(`workspace: ${workspace.path || '<none>'}`);
  console.log(`workspaceExists: ${workspace.exists}`);
  console.log(`personas: ${(scenario.personas || []).length}`);
  console.log(`cases: ${(scenario.cases || []).length}`);
  console.log(`actions: ${(scenario.actions || []).map(action => action.name || action.id).filter(Boolean).join(', ') || '<none>'}`);
  console.log(`modes: ${workspace.modes.join(', ') || '<not inspected>'}`);
  if (validation.warnings.length) {
    console.log(`\nwarnings:`);
    for (const warning of validation.warnings) console.log(`- ${warning}`);
  }
  if (validation.errors.length) {
    console.log(`\nerrors:`);
    for (const error of validation.errors) console.log(`- ${error}`);
  } else {
    console.log(`\nOK: scenario contract is valid.`);
  }
}

async function runScenario({ scenario, scenarioPath, workspace, outDir, mode, args }) {
  const runId = `${scenario.id || 'scenario'}-${timestampSlug()}`;
  const personas = limitArray(scenario.personas || [], args.personaLimit);
  const personaById = new Map(personas.map(persona => [persona.id, persona]));
  const cases = limitArray(scenario.cases || [], args.caseLimit);
  const records = [];
  const caseResults = [];

  for (const testCase of cases) {
    const selectedPersonas = testCase.persona
      ? [personaById.get(testCase.persona) || (scenario.personas || []).find(persona => persona.id === testCase.persona)]
      : personas;
    for (const persona of selectedPersonas.filter(Boolean)) {
      const sessionId = `${runId}-${testCase.id}-${persona.id}`.replace(/[^a-zA-Z0-9_.:-]/g, '-');
      const effectiveSessionId = mode === 'gateway' && gatewayTransport(args) === 'zego-callback'
        ? await createGatewayAgentInstance({ args, sessionId, workspaceId: args.workspaceId })
        : sessionId;
      const context = mergeContext(scenario.dynamicContext, testCase.dynamicContext);
      const transcript = [];
      const setupResults = [];
      const setupFailures = [];
      const setupSuggestedEdits = new Set();
      const turnFailures = [];
      const turnSuggestedEdits = new Set();
      const turnResults = [];

      if (mode === 'gateway' && hasContext(context)) {
        await putGatewayContext({ args, sessionId: effectiveSessionId, context });
      }

      const setupTurns = normalizeSetupTurns(testCase.setup);
      for (let index = 0; index < setupTurns.length; index += 1) {
        const setupTurn = setupTurns[index];
        const userText = renderTurnInput({ turn: setupTurn, persona, scenario, testCase, context });
        const response = mode === 'gateway'
          ? await callGatewayText({ args, sessionId: effectiveSessionId, workspaceId: args.workspaceId, userText, turnIndex: index })
          : await callMock({ testCase, turnIndex: index, userText, mockResponses: testCase.setup?.mockResponses || testCase.mockSetupResponses || [] });
        const setupRecord = {
          runId,
          scenarioId: scenario.id,
          caseId: testCase.id,
          personaId: persona.id,
          sessionId: effectiveSessionId,
          phase: 'setup',
          turnIndex: index,
          user: userText,
          assistant: response.text,
          modeEvents: response.modeEvents,
          actions: response.actions,
          actionEvents: response.actionEvents || [],
          latencyMs: response.latencyMs,
          chunks: response.chunks
        };
        setupResults.push(setupRecord);
        records.push({ type: 'setup_turn', ...setupRecord });
        transcript.push({ role: 'setup_user', content: userText });
        transcript.push({ role: 'setup_assistant', content: response.text, actions: response.actions, modeEvents: response.modeEvents });

        const setupExpect = setupTurn.expect || testCase.setup?.expect;
        if (setupExpect) {
          const setupEvaluation = evaluateExpect({ expect: setupExpect, context, turnResults: [setupRecord] });
          setupFailures.push(...setupEvaluation.failures.map(failure => ({ ...failure, phase: 'setup' })));
          for (const edit of setupEvaluation.suggestedEdits) setupSuggestedEdits.add(edit);
        }

        if (setupTurn.actionResult || testCase.setup?.actionResult) {
          const actionResult = setupTurn.actionResult || testCase.setup.actionResult;
          const submitted = mode === 'gateway'
            ? await submitGatewayActionResult({ args, response, actionResult })
            : { skipped: true, reason: 'mock mode' };
          records.push({
            type: 'action_result',
            runId,
            scenarioId: scenario.id,
            caseId: testCase.id,
            personaId: persona.id,
            sessionId: effectiveSessionId,
            phase: 'setup',
            turnIndex: index,
            ...submitted
          });
        }
      }

      const turns = testCase.turns || [];
      for (let index = 0; index < turns.length; index += 1) {
        const turn = turns[index];
        const userText = renderTurnInput({ turn, persona, scenario, testCase, context });
        const response = mode === 'gateway'
          ? await callGatewayText({ args, sessionId: effectiveSessionId, workspaceId: args.workspaceId, userText, turnIndex: setupTurns.length + index })
          : await callMock({ testCase, turnIndex: index, userText });
        const turnRecord = {
          runId,
          scenarioId: scenario.id,
          caseId: testCase.id,
          personaId: persona.id,
          sessionId: effectiveSessionId,
          phase: 'main',
          turnIndex: index,
          user: userText,
          assistant: response.text,
          modeEvents: response.modeEvents,
          actions: response.actions,
          actionEvents: response.actionEvents || [],
          latencyMs: response.latencyMs,
          chunks: response.chunks
        };
        transcript.push({ role: 'user', content: userText });
        transcript.push({ role: 'assistant', content: response.text, actions: response.actions, modeEvents: response.modeEvents });
        turnResults.push(turnRecord);
        records.push({ type: 'turn', ...turnRecord });

        if (turn.expect) {
          const turnEvaluation = evaluateExpect({ expect: turn.expect, context, turnResults: [turnRecord] });
          turnFailures.push(...turnEvaluation.failures.map(failure => ({ ...failure, phase: 'main', turnIndex: index })));
          for (const edit of turnEvaluation.suggestedEdits) turnSuggestedEdits.add(edit);
        }
      }

      const preliminarySuggestedEdits = new Set([...setupSuggestedEdits, ...turnSuggestedEdits]);
      const evaluation = evaluateCase({
        scenario,
        testCase,
        persona,
        context,
        turnResults,
        transcript,
        setupFailures: [...setupFailures, ...turnFailures],
        setupSuggestedEdits: preliminarySuggestedEdits
      });
      const result = {
        runId,
        scenarioId: scenario.id,
        caseId: testCase.id,
        personaId: persona.id,
        sessionId: effectiveSessionId,
        mode,
        transport: gatewayTransport(args),
        passed: evaluation.failures.length === 0,
        failures: evaluation.failures,
        warnings: evaluation.warnings,
        scores: evaluation.scores,
        suggestedEdits: evaluation.suggestedEdits,
        transcript,
        setupResults,
        turnResults
      };
      caseResults.push(result);
      records.push({ type: 'case_result', ...stripLarge(result) });
    }
  }

  const summary = summarize(caseResults);
  return {
    version: VERSION,
    runId,
    mode,
    seed: args.seed || 'default',
    startedAt: new Date().toISOString(),
    scenarioPath,
    outDir,
    workspace,
    scenario: {
      id: scenario.id,
      name: scenario.name,
      goal: scenario.scenario?.goal,
      successEvent: scenario.scenario?.successEvent
    },
    scenarioCases: scenario.cases || [],
    records,
    caseResults,
    summary
  };
}

function limitArray(items, limit) {
  if (!limit || !Number.isFinite(limit)) return items;
  return items.slice(0, Math.max(0, limit));
}

function renderTurnInput({ turn, persona, scenario, testCase, context }) {
  if (turn.user !== undefined || turn.text !== undefined) {
    return renderTemplate(String(turn.user ?? turn.text ?? ''), { persona, scenario, case: testCase, context });
  }
  if (turn.event) {
    return renderEventInput(turn);
  }
  return '';
}

function renderEventInput(turn) {
  if (turn.event === 'idle_timeout') {
    const seconds = turn.durationSeconds || turn.idleSeconds || turn.seconds || 20;
    const reason = turn.reason ? `原因：${turn.reason}。` : '';
    return `[本地评测事件：用户已沉默 ${seconds} 秒，当前没有新的用户语音输入。${reason}请按当前人设和上下文主动补一句自然的话；不要替用户做选择，也不要触发前端 ACTION。]`;
  }
  return `[本地评测事件：${turn.event}]`;
}

function mergeContext(base = {}, override = {}) {
  const fields = ['userContextMarkdown', 'sessionProfileMarkdown', 'runtimeStateMarkdown', 'recentObservationsMarkdown', 'decisionStateMarkdown'];
  const output = {};
  for (const field of fields) {
    const value = override[field] ?? base[field];
    if (value !== undefined && value !== null) output[field] = String(value);
  }
  return output;
}

function hasContext(context) {
  return Object.values(context || {}).some(value => String(value || '').trim());
}

function gatewayTransport(args) {
  return String(args.transport || 'text-chat').trim() || 'text-chat';
}

function normalizeSetupTurns(setup) {
  if (!setup) return [];
  if (Array.isArray(setup)) return setup;
  if (Array.isArray(setup.turns)) return setup.turns;
  if (setup.user || setup.text) return [setup];
  return [];
}

async function putGatewayContext({ args, sessionId, context }) {
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const route = (args.contextPath || DEFAULT_CONTEXT_PATH).replace(':sessionId', encodeURIComponent(sessionId));
  const url = new URL(route, `${baseUrl}/`);
  await jsonFetch(url, {
    method: 'PUT',
    headers: gatewayHeaders(args),
    body: JSON.stringify(context)
  });
}

async function callGatewayText({ args, sessionId, workspaceId, userText, turnIndex = 0 }) {
  if (gatewayTransport(args) === 'zego-callback') {
    return collectGatewayEvents({ args, sessionId }, () => callGatewayCallbackText({ args, sessionId, userText, turnIndex }));
  }
  const started = Date.now();
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const route = args.textPath || DEFAULT_TEXT_PATH;
  const url = new URL(route, `${baseUrl}/`);
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);
  const response = await fetch(url, {
    method: 'POST',
    headers: gatewayHeaders(args),
    body: JSON.stringify({
      sessionId,
      message: userText,
      ...(workspaceId ? { workspaceId } : {})
    })
  });
  if (!response.ok) throw new Error(`Gateway text request failed: ${response.status} ${await response.text()}`);
  const raw = await response.text();
  const parsed = parseSse(raw);
  return {
    text: parsed.text.trim(),
    actions: uniqueActions([...parsed.actions, ...extractActions(parsed.text)]),
    actionEvents: parsed.actionEvents,
    modeEvents: parsed.modeEvents,
    chunks: parsed.chunks,
    latencyMs: Date.now() - started
  };
}

async function callGatewayCallbackText({ args, sessionId, userText, turnIndex = 0 }) {
  const started = Date.now();
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const route = args.callbackPath || DEFAULT_CALLBACK_PATH;
  const url = new URL(route, `${baseUrl}/`);
  const response = await fetch(url, {
    method: 'POST',
    headers: gatewayCallbackHeaders(args),
    body: JSON.stringify({
      messages: [{ role: 'user', content: userText }],
      agent_info: {
        agent_instance_id: sessionId,
        user_id: shortGatewayId(`u_${sessionId}`, 32),
        room_id: 'scenario_eval_room',
        agent_user_id: shortGatewayId(`a_${sessionId}`, 32),
        round_id: String(turnIndex + 1)
      }
    })
  });
  if (!response.ok) throw new Error(`Gateway callback request failed: ${response.status} ${await response.text()}`);
  const raw = await response.text();
  const parsed = parseSse(raw);
  return {
    text: parsed.text.trim(),
    actions: uniqueActions([...parsed.actions, ...extractActions(parsed.text)]),
    actionEvents: parsed.actionEvents,
    modeEvents: parsed.modeEvents,
    chunks: parsed.chunks,
    latencyMs: Date.now() - started
  };
}

async function collectGatewayEvents({ args, sessionId }, run) {
  const controller = new AbortController();
  const events = [];
  const eventReader = readGatewayEvents({ args, sessionId, controller, events });
  await delay(120);
  const result = await run();
  await delay(650);
  controller.abort();
  await eventReader.catch(() => {});
  const actionEvents = events
    .filter(event => event.type === 'action_signal')
    .map(event => ({
      content: String(event.content || event.text || event.action || ''),
      actionInstanceId: event.actionInstanceId || event.action_instance_id || event.id
    }))
    .filter(event => event.content);
  const modeEvents = events
    .filter(event => event.type === 'mode_update' && event.mode)
    .map(event => String(event.mode));
  return {
    ...result,
    actions: uniqueActions([...result.actions, ...actionEvents.map(event => event.content)]),
    actionEvents: [...(result.actionEvents || []), ...actionEvents],
    modeEvents: uniqueActions([...(result.modeEvents || []), ...modeEvents])
  };
}

async function readGatewayEvents({ args, sessionId, controller, events }) {
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const url = new URL('/voice/events', `${baseUrl}/`);
  url.searchParams.set('sessionId', sessionId);
  const response = await fetch(url, {
    headers: gatewayHeaders(args),
    signal: controller.signal
  });
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf('\n\n');
    while (index >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.replace(/^data:\s*/, '').trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          events.push(JSON.parse(payload));
        } catch {
          // ignore non-JSON heartbeat/debug events
        }
      }
      index = buffer.indexOf('\n\n');
    }
  }
}

async function createGatewayAgentInstance({ args, sessionId, workspaceId }) {
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const route = args.agentInstancesPath || DEFAULT_AGENT_INSTANCES_PATH;
  const url = new URL(route, `${baseUrl}/`);
  const response = await fetch(url, {
    method: 'POST',
    headers: gatewayHeaders(args),
    body: JSON.stringify({
      workspaceId,
      userId: shortGatewayId(`u_${sessionId}`, 32),
      roomId: 'scenario_eval_room',
      agentUserId: shortGatewayId(`a_${sessionId}`, 32),
      agentStreamId: shortGatewayId(`as_${sessionId}`, 128),
      userStreamId: shortGatewayId(`us_${sessionId}`, 128),
      clientRequestId: shortGatewayId(`req_${sessionId}`, 128),
      metadata: {
        source: 'scenario-eval',
        logicalSessionId: sessionId
      }
    })
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // handled below
  }
  const agentInstanceId = data.agentInstanceId || data.AgentInstanceId || data.session?.agentInstanceId || data.session?.AgentInstanceId;
  if (!response.ok || !agentInstanceId) {
    throw new Error(`Failed to create Gateway agent instance: HTTP ${response.status} ${raw.slice(0, 500)}`);
  }
  return String(agentInstanceId);
}

async function submitGatewayActionResult({ args, response, actionResult }) {
  const actionEvent = findActionEventForResult(response, actionResult);
  if (!actionEvent?.actionInstanceId) {
    throw new Error(`setup.actionResult requires actionInstanceId, but no action_signal event with actionInstanceId was observed. Use --transport zego-callback for real action-result setup.`);
  }
  const baseUrl = trimTrailingSlash(args.gatewayUrl);
  const route = args.actionResultPath || DEFAULT_ACTION_RESULT_PATH;
  const url = new URL(route, `${baseUrl}/`);
  const body = {
    actionInstanceId: actionEvent.actionInstanceId,
    resultDescription: actionResult.resultDescription || actionResult.description || 'Front-end action result submitted by scenario-eval.',
    responsePolicy: actionResult.responsePolicy || 'silent',
    status: actionResult.status || 'completed',
    ...(actionResult.payload ? { payload: actionResult.payload } : {})
  };
  const result = await jsonFetch(url, {
    method: 'POST',
    headers: gatewayHeaders(args),
    body: JSON.stringify(body)
  });
  return {
    success: true,
    action: actionEvent.content,
    actionInstanceId: actionEvent.actionInstanceId,
    status: body.status,
    responsePolicy: body.responsePolicy,
    delivery: result.delivery,
    observationRecorded: result.observationRecorded
  };
}

function findActionEventForResult(response, actionResult = {}) {
  const expected = normalizeActionExpectation(actionResult.action || actionResult.expectedAction || actionResult);
  const events = response.actionEvents || [];
  if (!expected.name) return events[0];
  return events.find(event => actionMatchesExpectation(event.content, expected)) || events.find(event => actionMatchesName(event.content, expected.name)) || events[0];
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function gatewayHeaders(args) {
  const headers = { 'content-type': 'application/json' };
  if (args.authToken) headers.authorization = `Bearer ${args.authToken}`;
  return headers;
}

function gatewayCallbackHeaders(args) {
  const headers = { 'content-type': 'application/json' };
  const token = args.callbackToken || args.authToken;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function parseSse(raw) {
  const chunks = [];
  const actions = [];
  const actionEvents = [];
  const modeEvents = [];
  let text = '';
  for (const block of raw.split(/\n\n+/)) {
    const line = block.split(/\n/).find(item => item.startsWith('data:'));
    if (!line) continue;
    const payload = line.replace(/^data:\s*/, '').trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const chunk = JSON.parse(payload);
      chunks.push(chunk);
      const openAiContent = chunk.choices?.[0]?.delta?.content;
      if (chunk.type === 'action_signal') {
        const action = chunk.content || chunk.text || chunk.action || '';
        actions.push(action);
        actionEvents.push({
          content: action,
          actionInstanceId: chunk.actionInstanceId || chunk.action_instance_id || chunk.id
        });
      }
      if (chunk.type === 'mode_update') modeEvents.push(chunk.mode || chunk.content || '');
      if (openAiContent) {
        text += openAiContent;
      } else if (chunk.type !== 'thought' && chunk.type !== 'mode_update' && chunk.type !== 'action_signal') {
        text += chunk.content || chunk.text || '';
      }
    } catch {
      text += payload;
    }
  }
  return { text, actions: uniqueActions(actions), actionEvents, modeEvents: modeEvents.filter(Boolean), chunks };
}

async function callMock({ testCase, turnIndex, userText, mockResponses }) {
  const started = Date.now();
  const mock = (mockResponses || testCase.mockResponses || [])[turnIndex] || {};
  const text = mock.text || `Mock response to: ${userText}`;
  const actions = uniqueActions([...(mock.actions || []), ...extractActions(text)]);
  return {
    text,
    actions,
    actionEvents: (mock.actionEvents || []).filter(Boolean),
    modeEvents: (mock.modeEvents || mock.modes || []).filter(Boolean),
    chunks: [{ type: 'mock', content: text }],
    latencyMs: Date.now() - started
  };
}

function evaluateExpect({ expect = {}, context, turnResults }) {
  const failures = [];
  const suggestedEdits = new Set();
  const allText = turnResults.map(turn => turn.assistant).join('\n');
  const allActions = uniqueActions(turnResults.flatMap(turn => turn.actions || []));
  const allModes = turnResults.flatMap(turn => turn.modeEvents || []).filter(Boolean);

  for (const rawRequired of expect.requiredActions || []) {
    const required = normalizeActionExpectation(rawRequired);
    if (!required.name) continue;
    const candidates = allActions.filter(action => actionMatchesName(action, required.name));
    if (candidates.length === 0) {
      failures.push({
        category: 'action_contract',
        message: `Required action not emitted: ${required.name}`,
        evidence: `actions=[${allActions.join(', ') || 'none'}]`
      });
      suggestedEdits.add('action contract or mode prompt');
      continue;
    }
    const missingPayload = required.contains.filter(fragment => !candidates.some(action => action.includes(fragment)));
    if (missingPayload.length) {
      failures.push({
        category: 'action_payload',
        message: `Required action payload missing: ${missingPayload.join(', ')}`,
        evidence: `expected=${describeActionExpectation(required)} actions=[${candidates.join(', ')}]`
      });
      suggestedEdits.add('action contract or mode prompt');
    }
  }
  for (const rawForbidden of expect.forbiddenActions || []) {
    const forbidden = normalizeActionExpectation(rawForbidden);
    if (!forbidden.name) continue;
    if (allActions.some(action => actionMatchesExpectation(action, forbidden))) {
      failures.push({
        category: 'action_contract',
        message: `Forbidden action emitted: ${describeActionExpectation(forbidden)}`,
        evidence: `actions=[${allActions.join(', ')}]`
      });
      suggestedEdits.add('action contract or mode prompt');
    }
  }
  if (expect.noAction && allActions.length > 0) {
    failures.push({
      category: 'action_contract',
      message: 'Expected no action, but action was emitted',
      evidence: `actions=[${allActions.join(', ')}]`
    });
    suggestedEdits.add('action contract or mode prompt');
  }
  if (expect.maxActions !== undefined && allActions.length > Number(expect.maxActions)) {
    failures.push({
      category: 'action_contract',
      message: `Expected at most ${expect.maxActions} action(s)`,
      evidence: `actions=[${allActions.join(', ')}]`
    });
    suggestedEdits.add('action contract or mode prompt');
  }
  if (expect.finalMode && allModes.at(-1) !== expect.finalMode) {
    failures.push({
      category: 'mode_boundary',
      message: `Expected final mode ${expect.finalMode}`,
      evidence: `modeEvents=[${allModes.join(', ') || 'none'}]`
    });
    suggestedEdits.add('modes/*.md');
  }
  for (const phrase of expect.requiredPhrases || []) {
    if (!containsFolded(allText, phrase)) {
      failures.push({
        category: 'response_quality',
        message: `Missing required phrase: ${phrase}`,
        evidence: firstText(allText)
      });
      suggestedEdits.add('modes/*.md or knowledge/*');
    }
  }
  for (const phrase of expect.forbiddenPhrases || []) {
    if (containsFolded(allText, phrase)) {
      failures.push({
        category: 'red_line',
        message: `Forbidden phrase appeared: ${phrase}`,
        evidence: phrase
      });
      suggestedEdits.add('SOUL.md, AGENTS.md, or modes/*.md');
    }
  }
  for (const phrase of expect.contextRequiredPhrases || []) {
    if (!containsFolded(allText, phrase)) {
      failures.push({
        category: 'dynamic_context',
        message: `Dynamic context was not reflected: ${phrase}`,
        evidence: contextEvidence(context)
      });
      suggestedEdits.add('dynamic context contract or mode prompt');
    }
  }
  for (const phrase of expect.contextForbiddenPhrases || []) {
    if (containsFolded(allText, phrase)) {
      failures.push({
        category: 'dynamic_context',
        message: `Forbidden dynamic-context claim appeared: ${phrase}`,
        evidence: phrase
      });
      suggestedEdits.add('dynamic context contract or mode prompt');
    }
  }
  if (expect.noProtocolLeak !== false) {
    const leak = findProtocolLeak(allText);
    if (leak) {
      failures.push({
        category: 'protocol_leak',
        message: 'Protocol text leaked into assistant reply',
        evidence: leak
      });
      suggestedEdits.add('AGENTS.md, SOUL.md, or mode prompt');
    }
  }
  return { failures, suggestedEdits: Array.from(suggestedEdits), allText, allActions, allModes };
}

function evaluateCase({ scenario, testCase, persona, context, turnResults, transcript, setupFailures = [], setupSuggestedEdits = new Set() }) {
  const warnings = [];
  const evaluation = evaluateExpect({ expect: testCase.expect || {}, context, turnResults });
  const failures = [...setupFailures, ...evaluation.failures];
  const suggestedEdits = new Set([...setupSuggestedEdits, ...evaluation.suggestedEdits]);
  const allText = evaluation.allText;
  const allActions = evaluation.allActions;

  const hardPass = failures.length === 0;
  const scores = {
    hardRules: hardPass ? 5 : Math.max(1, 5 - failures.length),
    userFeedback: scoreUserFeedback({ hardPass, persona, allText, allActions }),
    observerReview: scoreObserver({ failures, allText }),
    businessReview: scoreBusiness({ failures, scenario, testCase, allActions })
  };

  if (!allText.trim()) {
    warnings.push({
      category: 'response_quality',
      message: 'Assistant produced an empty response'
    });
    suggestedEdits.add('runtime adapter or mode prompt');
  }

  return {
    failures,
    warnings,
    scores,
    suggestedEdits: Array.from(suggestedEdits),
    judgeNotes: buildJudgeNotes({ failures, warnings, persona, scenario, testCase, transcript, allActions })
  };
}

function actionName(action) {
  return String(action || '').replace(/^\[ACTION:/i, '').replace(/\]$/g, '').split(/\s+/)[0].trim();
}

function normalizeActionExpectation(value) {
  if (typeof value === 'string') return { name: value, contains: [] };
  if (!value || typeof value !== 'object') return { name: '', contains: [] };
  return {
    name: String(value.name || value.action || value.id || '').trim(),
    contains: arrayOfStrings(value.contains || value.payloadContains || value.payloadIncludes || value.includes)
  };
}

function arrayOfStrings(value) {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map(item => String(item)).filter(Boolean);
}

function actionMatchesName(action, expectedName) {
  return actionName(action) === expectedName || String(action || '').includes(String(expectedName || ''));
}

function actionMatchesExpectation(action, expectation) {
  if (!actionMatchesName(action, expectation.name)) return false;
  return expectation.contains.every(fragment => String(action || '').includes(fragment));
}

function describeActionExpectation(expectation) {
  return expectation.contains.length
    ? `${expectation.name} contains ${expectation.contains.join(' + ')}`
    : expectation.name;
}

function extractActions(text) {
  const actions = [];
  ACTION_RE.lastIndex = 0;
  let match;
  while ((match = ACTION_RE.exec(text || ''))) {
    actions.push(`[ACTION:${match[1]}${match[2] || ''}]`);
  }
  return uniqueActions(actions);
}

function uniqueActions(actions) {
  return Array.from(new Set((actions || []).map(action => String(action || '').trim()).filter(Boolean)));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shortGatewayId(value, maxLength) {
  const normalized = String(value || '').replace(/[^A-Za-z0-9_]/g, '_');
  if (normalized.length <= maxLength) return normalized;
  const hash = simpleHash(normalized);
  const prefix = normalized.slice(0, Math.max(1, maxLength - hash.length - 1));
  return `${prefix}_${hash}`.slice(0, maxLength);
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function containsFolded(text, phrase) {
  return String(text || '').toLowerCase().includes(String(phrase || '').toLowerCase());
}

function findProtocolLeak(text) {
  const patterns = [
    /\btrigger_sle_check\b/i,
    /\bmode_switch\s*\(/i,
    /<shadow>[\s\S]*?<\/shadow>/i,
    /\bFUNC\s*[:=]/i,
    /\btool_call\b/i
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match) return match[0];
  }
  return '';
}

function contextEvidence(context) {
  return Object.entries(context || {})
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => `${key}: ${String(value).slice(0, 80)}`)
    .join(' | ') || '<empty context>';
}

function firstText(text) {
  return String(text || '').replace(/\s+/g, ' ').slice(0, 160);
}

function scoreUserFeedback({ hardPass, persona, allText, allActions }) {
  let score = hardPass ? 4 : 2;
  if (allActions.length && /refuse|reject|decline|not ready/i.test(`${persona.behaviorStyle} ${persona.actionAcceptanceThreshold}`)) score -= 1;
  if (/sorry|can't|cannot|unclear/i.test(allText)) score -= 1;
  return clampScore(score);
}

function scoreObserver({ failures, allText }) {
  let score = failures.length ? 3 : 5;
  if (findProtocolLeak(allText)) score -= 2;
  return clampScore(score);
}

function scoreBusiness({ failures, scenario, testCase, allActions }) {
  let score = failures.some(failure => ['red_line', 'action_contract'].includes(failure.category)) ? 2 : 4;
  if ((testCase.expect?.requiredActions || []).length && allActions.length) score += 1;
  if (scenario.scenario?.successEvent && failures.length === 0) score += 0;
  return clampScore(score);
}

function clampScore(value) {
  return Math.max(1, Math.min(5, Number(value) || 1));
}

function buildJudgeNotes({ failures, warnings, persona, testCase, allActions }) {
  const evidence = failures[0]?.evidence || warnings[0]?.message || `actions=[${allActions.join(', ') || 'none'}]`;
  return {
    userAgentFeedback: failures.length
      ? `${persona.id} would likely hesitate because ${failures[0].message}. Evidence: ${evidence}`
      : `${persona.id} can continue because the hard expectations for ${testCase.id} passed.`,
    observerReview: failures.length
      ? `Primary issue category: ${failures[0].category}. Start by fixing the customer-editable prompt or action contract tied to that category.`
      : 'No hard-rule issue found in this local text simulation.',
    businessReview: failures.some(failure => failure.category === 'red_line')
      ? 'Business red line failed; do not tune style before fixing this case.'
      : failures.some(failure => failure.category === 'action_contract')
        ? 'Business action contract needs tightening before using this scene as a regression pass.'
        : 'Business path is acceptable for this text-only check; Live E2E remains a separate validation layer.'
  };
}

function summarize(caseResults) {
  const failed = caseResults.filter(result => !result.passed);
  const categories = {};
  for (const result of failed) {
    for (const failure of result.failures) {
      categories[failure.category] = (categories[failure.category] || 0) + 1;
    }
  }
  return {
    totalCases: caseResults.length,
    passedCases: caseResults.length - failed.length,
    failedCases: failed.length,
    passRate: caseResults.length ? Number(((caseResults.length - failed.length) / caseResults.length).toFixed(4)) : 0,
    failureCategories: categories
  };
}

function writeReports(run, outDir) {
  fs.writeFileSync(
    path.join(outDir, 'run.jsonl'),
    run.records.map(record => JSON.stringify(record)).join('\n') + '\n'
  );
  fs.writeFileSync(path.join(outDir, 'summary.md'), renderSummary(run));
  fs.writeFileSync(path.join(outDir, 'failures.csv'), renderFailuresCsv(run));
  fs.writeFileSync(path.join(outDir, 'suggested-edits.md'), renderSuggestedEdits(run));
  fs.writeFileSync(path.join(outDir, 'coverage.md'), renderCoverage(run));
}

function renderSummary(run) {
  const lines = [];
  lines.push(`# Scenario Eval Summary`);
  lines.push('');
  lines.push(`- Run ID: \`${run.runId}\``);
  lines.push(`- Scenario: \`${run.scenario.id || ''}\` ${run.scenario.name || ''}`);
  lines.push(`- Mode: \`${run.mode}\``);
  lines.push(`- Workspace: \`${run.workspace.path || '<not provided>'}\``);
  lines.push(`- Pass rate: ${(run.summary.passRate * 100).toFixed(1)}% (${run.summary.passedCases}/${run.summary.totalCases})`);
  lines.push('');
  lines.push(`## Case Results`);
  lines.push('');
  lines.push(`| Case | Persona | Result | Scores | Failures |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const result of run.caseResults) {
    const scoreText = Object.entries(result.scores).map(([key, value]) => `${key}:${value}`).join(' ');
    const failureText = result.failures.map(failure => `${failure.category}: ${failure.message}`).join('<br>') || '-';
    lines.push(`| ${escapeMd(result.caseId)} | ${escapeMd(result.personaId)} | ${result.passed ? 'PASS' : 'FAIL'} | ${escapeMd(scoreText)} | ${escapeMd(failureText)} |`);
  }
  lines.push('');
  lines.push(`## Judge Notes`);
  lines.push('');
  for (const result of run.caseResults) {
    const notes = buildJudgeNotes({
      failures: result.failures,
      warnings: result.warnings,
      persona: { id: result.personaId },
      testCase: { id: result.caseId },
      allActions: result.turnResults.flatMap(turn => turn.actions || [])
    });
    lines.push(`### ${result.caseId} / ${result.personaId}`);
    lines.push('');
    lines.push(`- User agent: ${notes.userAgentFeedback}`);
    lines.push(`- Observer: ${notes.observerReview}`);
    lines.push(`- Business: ${notes.businessReview}`);
    lines.push('');
  }
  lines.push(`## Validation Boundary`);
  lines.push('');
  lines.push(`This is a local text-only scenario evaluation. It does not prove RTC, ASR, TTS, browser rendering, or Live E2E success.`);
  return lines.join('\n');
}

function renderFailuresCsv(run) {
  const rows = [['caseId', 'personaId', 'category', 'message', 'evidence', 'suggestedEdits']];
  for (const result of run.caseResults) {
    for (const failure of result.failures) {
      rows.push([
        result.caseId,
        result.personaId,
        failure.category,
        failure.message,
        failure.evidence,
        result.suggestedEdits.join('; ')
      ]);
    }
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

function renderSuggestedEdits(run) {
  const grouped = {};
  for (const result of run.caseResults) {
    for (const edit of result.suggestedEdits || []) {
      grouped[edit] = grouped[edit] || [];
      grouped[edit].push(result);
    }
  }
  const lines = ['# Suggested Edits', ''];
  if (Object.keys(grouped).length === 0) {
    lines.push('No hard-rule failures found. Review transcripts before making style-only prompt changes.');
  }
  for (const [edit, results] of Object.entries(grouped)) {
    lines.push(`## ${edit}`);
    lines.push('');
    for (const result of results) {
      const firstFailure = result.failures[0];
      lines.push(`- ${result.caseId} / ${result.personaId}: ${firstFailure?.message || 'review case'} (${firstFailure?.category || 'review'})`);
    }
    lines.push('');
  }
  lines.push('Do not apply these suggestions automatically. Inspect the customer workspace and change one failure category at a time.');
  return lines.join('\n');
}

function renderCoverage(run) {
  const rows = run.caseResults.map(result => {
    const testCase = (run.scenarioCases || []).find(item => item.id === result.caseId) || {};
    const tags = coverageTags(testCase);
    return {
      caseId: result.caseId,
      personaId: result.personaId,
      result: result.passed ? 'PASS' : 'FAIL',
      tags
    };
  });
  const tagCounts = {};
  for (const row of rows) {
    for (const tag of row.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const lines = ['# Scenario Coverage', ''];
  lines.push('## Coverage Counts');
  lines.push('');
  lines.push('| Tag | Cases |');
  lines.push('| --- | ---: |');
  for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${escapeMd(tag)} | ${count} |`);
  }
  if (Object.keys(tagCounts).length === 0) lines.push('| <none> | 0 |');
  lines.push('');
  lines.push('## Case Matrix');
  lines.push('');
  lines.push('| Case | Persona | Result | Tags |');
  lines.push('| --- | --- | --- | --- |');
  for (const row of rows) {
    lines.push(`| ${escapeMd(row.caseId)} | ${escapeMd(row.personaId)} | ${row.result} | ${escapeMd(row.tags.join(', ') || '-')} |`);
  }
  lines.push('');
  lines.push('Coverage is inferred from scenario metadata and expectations. It is a planning aid, not a substitute for reading transcripts.');
  return lines.join('\n');
}

function coverageTags(testCase) {
  const tags = new Set(arrayOfStrings(testCase.coverage || testCase.tags || testCase.group));
  const expect = testCase.expect || {};
  const contextText = JSON.stringify(testCase.dynamicContext || {}).toLowerCase();
  if (testCase.setup?.actionResult) tags.add('action-result-loop');
  if (contextText.includes('completed') || contextText.includes('已完成') || contextText.includes('成功')) tags.add('completed-repeat');
  if (contextText.includes('rejected') || contextText.includes('拒绝') || contextText.includes('取消')) tags.add('rejected');
  if (contextText.includes('failed') || contextText.includes('失败')) tags.add('failed');
  if (contextText.includes('重试') || contextText.includes('再试') || contextText.includes('反悔')) tags.add('explicit-retry');
  if (contextText.includes('current_room_type') || contextText.includes('当前状态')) tags.add('runtime-state');
  if (contextText.includes('sessionprofile') || contextText.includes('偏好') || contextText.includes('新用户')) tags.add('profile');
  if (expect.noAction) tags.add('no-action');
  if ((expect.requiredActions || []).length) tags.add('required-action');
  if ((expect.forbiddenActions || []).length) tags.add('forbidden-action');
  if ((expect.contextRequiredPhrases || []).length || (expect.contextForbiddenPhrases || []).length) tags.add('dynamic-context');
  if (expect.noProtocolLeak !== false) tags.add('protocol-leak-guard');
  return Array.from(tags).sort();
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function stripLarge(result) {
  return {
    runId: result.runId,
    scenarioId: result.scenarioId,
    caseId: result.caseId,
    personaId: result.personaId,
    sessionId: result.sessionId,
    mode: result.mode,
    passed: result.passed,
    failures: result.failures,
    warnings: result.warnings,
    scores: result.scores,
    suggestedEdits: result.suggestedEdits
  };
}

function printRunSummary(run, outDir) {
  console.log(`scenario-eval completed`);
  console.log(`runId: ${run.runId}`);
  console.log(`mode: ${run.mode}`);
  console.log(`cases: ${run.summary.passedCases}/${run.summary.totalCases} passed`);
  console.log(`out: ${outDir}`);
  if (run.summary.failedCases) {
    console.log(`failure categories: ${JSON.stringify(run.summary.failureCategories)}`);
  }
}

function renderTemplate(text, scope) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const parts = key.split('.');
    let current = scope;
    for (const part of parts) current = current?.[part];
    return current === undefined || current === null ? '' : String(current);
  });
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function parseSimpleYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .map(raw => ({ raw, line: stripYamlComment(raw) }))
    .filter(item => item.line.trim().length > 0);
  const [value, index] = parseYamlBlock(lines, 0, 0);
  if (index < lines.length) throw new Error(`Could not parse YAML near: ${lines[index].raw}`);
  return value;
}

function parseYamlBlock(lines, index, indent) {
  if (index >= lines.length) return [{}, index];
  const current = lines[index];
  const currentIndent = countIndent(current.line);
  if (currentIndent < indent) return [{}, index];
  if (current.line.trimStart().startsWith('- ')) return parseYamlList(lines, index, currentIndent);
  return parseYamlMap(lines, index, currentIndent);
}

function parseYamlMap(lines, index, indent) {
  const output = {};
  while (index < lines.length) {
    const line = lines[index].line;
    const currentIndent = countIndent(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) throw new Error(`Unexpected indentation near: ${lines[index].raw}`);
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) break;
    const match = trimmed.match(/^([^:]+):(.*)$/);
    if (!match) throw new Error(`Expected key: value near: ${lines[index].raw}`);
    const key = match[1].trim();
    const rest = match[2].trim();
    index += 1;
    if (rest) {
      output[key] = parseYamlScalar(rest);
    } else {
      const [child, next] = parseYamlBlock(lines, index, indent + 2);
      output[key] = child;
      index = next;
    }
  }
  return [output, index];
}

function parseYamlList(lines, index, indent) {
  const output = [];
  while (index < lines.length) {
    const line = lines[index].line;
    const currentIndent = countIndent(line);
    if (currentIndent < indent) break;
    if (currentIndent !== indent || !line.trimStart().startsWith('- ')) break;
    const rest = line.trimStart().slice(2).trim();
    index += 1;
    let item;
    if (!rest) {
      [item, index] = parseYamlBlock(lines, index, indent + 2);
    } else {
      const kv = rest.match(/^([^:'"]+):(.*)$/);
      if (kv) {
        item = {};
        const key = kv[1].trim();
        const value = kv[2].trim();
        if (value) {
          item[key] = parseYamlScalar(value);
        } else {
          const [child, next] = parseYamlBlock(lines, index, indent + 2);
          item[key] = child;
          index = next;
        }
        while (index < lines.length && countIndent(lines[index].line) === indent + 2 && !lines[index].line.trimStart().startsWith('- ')) {
          const [more, next] = parseYamlMap(lines, index, indent + 2);
          Object.assign(item, more);
          index = next;
        }
      } else {
        item = parseYamlScalar(rest);
      }
    }
    output.push(item);
  }
  return [output, index];
}

function parseYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return splitInlineList(inner).map(parseYamlScalar);
  }
  return trimmed;
}

function splitInlineList(value) {
  const parts = [];
  let current = '';
  let quote = '';
  for (const ch of value) {
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === quote) {
      quote = '';
      current += ch;
      continue;
    }
    if (ch === ',' && !quote) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function stripYamlComment(raw) {
  let quote = '';
  let output = '';
  for (const ch of raw) {
    if ((ch === '"' || ch === "'") && !quote) {
      quote = ch;
      output += ch;
      continue;
    }
    if (ch === quote) {
      quote = '';
      output += ch;
      continue;
    }
    if (ch === '#' && !quote) break;
    output += ch;
  }
  return output.replace(/\s+$/, '');
}

function countIndent(value) {
  return (value.match(/^ */) || [''])[0].length;
}

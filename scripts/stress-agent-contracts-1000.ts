import { AGENT_CONTRACTS, buildAgentContractInstruction } from '../src/lib/agentContracts.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let checks = 0;
for (const agent of AGENT_CONTRACTS) {
  for (let i = 0; i < 1000; i += 1) {
    const instruction = buildAgentContractInstruction(agent.id);
    const selector = i % 10;

    if (selector === 0) assert(instruction.includes(agent.label), `${agent.id}: label missing`);
    if (selector === 1) assert(instruction.includes(agent.mission), `${agent.id}: mission missing`);
    if (selector === 2) assert(agent.inputs.length > 0 && agent.inputs.every(Boolean), `${agent.id}: invalid inputs`);
    if (selector === 3) assert(agent.outputs.length > 0 && agent.outputs.every(Boolean), `${agent.id}: invalid outputs`);
    if (selector === 4) assert(agent.mustDo.length > 0 && agent.mustDo.every((x) => instruction.includes(x)), `${agent.id}: mustDo lost`);
    if (selector === 5) assert(agent.mustNot.length > 0 && agent.mustNot.every((x) => instruction.includes(x)), `${agent.id}: mustNot lost`);
    if (selector === 6) assert(instruction.includes(`عند الفشل: ${agent.failureAction}`), `${agent.id}: failure action missing`);
    if (selector === 7) assert(!/undefined|null\s*$/.test(instruction), `${agent.id}: malformed instruction`);
    if (selector === 8) assert(!/GEMINI_API_KEY|AI_GATEWAY_API_KEY|password\s*=|secret\s*=/i.test(instruction), `${agent.id}: secret-like material leaked`);
    if (selector === 9) assert(agent.implementation.trim().length > 0 && agent.mission.trim().length >= 20, `${agent.id}: weak contract metadata`);
    checks += 1;
  }
}

console.log(JSON.stringify({
  ok: true,
  agents: AGENT_CONTRACTS.length,
  iterationsPerAgent: 1000,
  checks,
}, null, 2));

import { launchBlockingContracts } from '../src/lib/agentContracts';

const blockers = launchBlockingContracts();

if (blockers.length) {
  console.error(JSON.stringify({
    ok: false,
    launchReady: false,
    blockers: blockers.map((item) => ({
      id: item.id,
      label: item.label,
      readiness: item.readiness,
      weakness: item.weaknesses,
      failureAction: item.failureAction,
    })),
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  launchReady: true,
  blockers: [],
}, null, 2));

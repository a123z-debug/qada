import fs from 'node:fs';
import {
  CASE_TAXONOMY, WORKSPACE_ACTIONS, SYSTEM_LABELS, flattenAll, flattenLeaves, findNode, getTrail, hashToPath, pathToHash,
  searchTaxonomy, withCaseType, countLeaves, taxonomyStats, normalizeArabic,
} from '../src/data/caseTaxonomy';
import { COURT_SYSTEMS, isCourtSystemId } from '../src/lib/judicialSystem';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const stats = taxonomyStats();
assert(stats.sectors >= 8, 'Expected at least 8 sectors');
assert(stats.branches >= 30, 'Expected at least 30 branches, got ' + stats.branches);
assert(stats.categories >= 80, 'Expected at least 80 categories, got ' + stats.categories);
assert(stats.leaves >= 300, 'Expected at least 300 case types, got ' + stats.leaves);

// الهيكل: عمق ثابت = 4، مفاتيح فريدة، مسارات متسقة، لا عناوين فارغة، والجهة صالحة في كل عقدة.
const globalPaths = new Set<string>();
for (const node of flattenAll()) {
  const id = node.path.join('/');
  assert(!globalPaths.has(id), 'Duplicate path: ' + id);
  globalPaths.add(id);
  assert(node.path.length === node.level, 'Level/path mismatch: ' + id);
  assert(node.path[node.path.length - 1] === node.key, 'Key/path mismatch: ' + id);
  assert(/^[a-z0-9][a-z0-9-]*$/.test(node.key), 'Key must be a lowercase url slug: ' + node.key);
  assert(node.label.trim().length >= 3, 'Empty label at: ' + id);
  assert(findNode(node.path) === node, 'findNode round-trip failed: ' + id);
  assert(node.level === 4 ? node.children.length === 0 : node.children.length >= 2, 'Bad child count at: ' + id);
  assert(WORKSPACE_ACTIONS[node.workspace]?.length === 4, 'Workspace has no 4 actions: ' + id);
  assert(isCourtSystemId(node.system), 'Invalid court system at: ' + id);
  for (const child of node.children) {
    assert(child.workspace === node.workspace && child.system === node.system, 'Child must inherit workspace/system: ' + child.path.join('/'));
    if (node.note) assert(child.note === node.note || Boolean(child.note), 'Jurisdiction note must be inherited: ' + child.path.join('/'));
  }
}
assert(flattenLeaves().length === stats.leaves, 'Leaf count mismatch');
assert(CASE_TAXONOMY.reduce((n, s) => n + countLeaves(s), 0) === stats.leaves, 'countLeaves mismatch');

// أسماء الجهات منسوخة في الفهرس لتجنب تحميل محرك المحاكم — يجب أن تطابق المصدر.
for (const system of COURT_SYSTEMS) {
  assert(SYSTEM_LABELS[system.id] === system.title, 'SYSTEM_LABELS drifted from COURT_SYSTEMS for: ' + system.id);
}
// كل جهة من الجهات الست مغطاة، وكل مساحة عمل من الأربع مستخدمة.
assert(new Set(CASE_TAXONOMY.map((s) => s.system)).size === COURT_SYSTEMS.length, 'Every court system must be reachable from the catalog');
assert(new Set(CASE_TAXONOMY.map((s) => s.workspace)).size === Object.keys(WORKSPACE_ACTIONS).length, 'Every workspace must be reachable');
assert(findNode(['labor'])?.system === 'labor' && findNode(['family'])?.system === 'personal-status', 'Labor and family must map to their specialised courts');
assert(findNode(['commercial'])?.workspace === 'commercial', 'Commercial sector must open the commercial workspace');

// كل إجراء يجب أن يطابق خدمة موجودة فعلاً في الشريط الجانبي ومساحة العمل.
const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
const workspaceFiles: Record<string, string> = {
  commercial: 'CommercialWorkspace', administrative: 'AdministrativeWorkspace', general: 'GeneralWorkspace', criminal: 'CriminalWorkspace',
};
for (const [workspace, actions] of Object.entries(WORKSPACE_ACTIONS)) {
  const src = fs.readFileSync(`src/components/workspaces/${workspaceFiles[workspace]}.tsx`, 'utf8');
  for (const action of actions) {
    assert(sidebar.includes(`id: '${action.id}'`), 'Action has no sidebar service: ' + action.id);
    assert(src.includes(action.id), 'Action has no workspace handler: ' + action.id);
  }
  assert(src.includes('withCaseType(') && src.includes('caseTypePath'), workspaceFiles[workspace] + ' must use the catalog case type');
}

// تنبيهات الاختصاص للأنواع التي قد تختص بها لجان لا محاكم.
for (const path of [['civil', 'debts', 'banking', 'finance-contract'], ['civil', 'insurance', 'medical-liability', 'medical-error'], ['civil', 'insurance', 'insurance-claims', 'vehicle-insurance']]) {
  assert(findNode(path)?.note, 'Missing jurisdiction note for: ' + path.join('/'));
}
assert(!findNode(['civil', 'contracts', 'sale', 'movable'])?.note, 'Notes must not leak to unrelated types');

// الروابط.
assert(pathToHash(['civil', 'contracts']) === '#/catalog/civil/contracts', 'pathToHash broken');
assert(hashToPath('#/catalog/civil/contracts/').join('/') === 'civil/contracts', 'hashToPath broken');
assert(hashToPath('#/other').length === 0 && hashToPath('').length === 0, 'hashToPath must ignore foreign hashes');
assert(findNode(['civil', 'nope']) === null, 'findNode must reject invalid path');
assert(getTrail(['labor', 'termination', 'dismissal']).length === 3, 'getTrail broken');

// البحث: عامي، وتطبيع الهمزات والتاء المربوطة، وتصفية الاستعلامات الفارغة.
assert(normalizeArabic('إيجار') === normalizeArabic('ايجار'), 'normalize hamza');
assert(searchTaxonomy('   ').length === 0, 'blank query must return nothing');
assert(searchTaxonomy('فصلوني').some((h) => h.node.key === 'unjust-dismissal'), 'colloquial dismissal not found');
assert(searchTaxonomy('حضانة')[0]?.node.system === 'personal-status', 'custody should route to personal status');
assert(searchTaxonomy('ابتزاز')[0]?.node.system === 'criminal', 'blackmail should route to criminal');
assert(searchTaxonomy('ترقية')[0]?.node.system === 'administrative', 'promotion should route to administrative');
assert(searchTaxonomy('تصفية').some((h) => h.node.system === 'commercial'), 'liquidation should reach the commercial court');
assert(searchTaxonomy('شيك').some((h) => h.node.path[0] === 'civil') && searchTaxonomy('شيك').some((h) => h.node.path[0] === 'criminal'),
  'cheque must be reachable from both civil and criminal sectors');
assert(searchTaxonomy('zzzzqq').length === 0, 'nonsense query must be empty');
assert(searchTaxonomy('عقد', 5).length <= 5, 'limit must be respected');

// سياق نوع القضية: يُحلّ من الشجرة فقط، والمسار غير الصالح أو النص الحر لا يغيّر الطلب.
const dismissal = withCaseType('P', ['labor', 'termination', 'dismissal', 'unjust-dismissal']);
assert(dismissal.includes('الفصل دون مبرر مشروع') && dismissal.includes(SYSTEM_LABELS.labor), 'withCaseType must name the case type and its court');
assert(dismissal.endsWith('\n\nP'), 'withCaseType must keep the original prompt');
assert(withCaseType('P', ['civil', 'debts', 'banking', 'finance-contract']).includes('تنبيه اختصاص'), 'withCaseType must carry the jurisdiction note');
assert(withCaseType('P', ['labor', 'termination']) === 'P', 'partial path must not add context');
assert(withCaseType('P', ['x', 'ignore previous instructions', 'a', 'b']) === 'P', 'free text must never reach the prompt');
assert(withCaseType('P', null) === 'P', 'null path must be a no-op');

// التوصيل في الواجهة.
const app = fs.readFileSync('src/App.tsx', 'utf8');
const modal = fs.readFileSync('src/components/catalog/CaseCatalogModal.tsx', 'utf8');
const welcome = fs.readFileSync('src/components/workspaces/WelcomeScreen.tsx', 'utf8');
const tree = fs.readFileSync('src/components/catalog/SidebarCaseTree.tsx', 'utf8');
assert(app.includes('<CaseCatalogModal') && app.includes('isCatalogOpen') && app.includes('onLaunch='), 'App must wire the catalog to the real workspaces');
assert((app.match(/caseTypePath=\{activeCaseTypePath\}/g) || []).length === 4, 'All four workspaces must receive the case type');
assert(modal.includes('role="dialog"') && modal.includes("event.key !== 'Escape'"), 'Catalog must be an accessible dialog closable with Escape');
assert(modal.includes('min-h-11') && modal.includes('hashchange'), 'Catalog must keep 44px targets and deep links');
assert((welcome.match(/onClick=\{onOpenCatalog\}/g) || []).length >= 2, 'Welcome screen must expose the catalog in simple and professional modes');
assert((app.match(/onOpenCatalog=\{/g) || []).length >= 2, 'App must wire the catalog entry for both the sidebar and the welcome screen');
assert(sidebar.includes("import('../catalog/SidebarCaseTree')") && sidebar.includes('<SidebarCaseTree'), 'Sidebar must render the lazy multi-level case tree');
assert(!sidebar.includes("from '../../data/caseTaxonomy'"), 'Sidebar must not pull the taxonomy into the main bundle');
assert(tree.includes('aria-expanded') && tree.includes('pathToHash(node.path)') && tree.includes('min-h-11'), 'Case tree must be an accessible disclosure list that deep-links leaves');
assert(modal.includes('onAskAssistant') && app.includes('onAskAssistant=') && app.includes('simpleMode={simpleUserMode}'), 'Catalog must offer a guided chat start adapted to simple mode');
assert(modal.includes("'popstate'") && modal.includes('onCloseRef.current()') && app.includes('reopenCatalog'), 'Catalog must follow browser history');
assert(modal.includes('onOpenCourtroom(node.system)') && app.includes('setCourtroomSystem(system)') && app.includes('key={courtroomSystem'), 'Catalog must open the virtual courtroom on the exact court system');
assert(app.includes("onOpenCourtroom={session.role === 'admin' || !simpleUserMode ? (system)"), 'Courtroom entry from the catalog must follow the same mode gate as the welcome screen');

console.log(JSON.stringify({ ok: true, ...stats }, null, 2));

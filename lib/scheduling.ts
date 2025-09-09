import { Prisma, Todo, TodoDependency } from '@prisma/client';
import { prisma } from './prisma';

type Id = string;

type Graph = {
  // dependency -> dependents
  adj: Map<Id, Set<Id>>;
  // dependent -> dependencies
  rev: Map<Id, Set<Id>>;
  nodes: Set<Id>;
};

function buildGraph(todos: Pick<Todo, 'id'>[], deps: Pick<TodoDependency, 'dependencyId' | 'dependentId'>[]): Graph {
  const adj = new Map<Id, Set<Id>>();
  const rev = new Map<Id, Set<Id>>();
  const nodes = new Set<Id>(todos.map(t => t.id));
  for (const id of Array.from(nodes)) {
    adj.set(id, new Set());
    rev.set(id, new Set());
  }
  for (const d of deps) {
    if (!nodes.has(d.dependencyId) || !nodes.has(d.dependentId)) continue;
    adj.get(d.dependencyId)!.add(d.dependentId);
    rev.get(d.dependentId)!.add(d.dependencyId);
  }
  return { adj, rev, nodes };
}

function topoSort(g: Graph): Id[] {
  const indeg = new Map<Id, number>();
  for (const n of Array.from(g.nodes)) indeg.set(n, g.rev.get(n)?.size || 0);
  const q: Id[] = [];
  for (const [n, d] of Array.from(indeg)) if (d === 0) q.push(n);
  const order: Id[] = [];
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++];
    order.push(u);
    for (const v of Array.from(g.adj.get(u) || [])) {
      indeg.set(v, (indeg.get(v) || 0) - 1);
      if ((indeg.get(v) || 0) === 0) q.push(v);
    }
  }
  if (order.length !== g.nodes.size) {
    throw new Error('Cycle detected');
  }
  return order;
}

export function wouldCreateCycle(
  todos: Pick<Todo, 'id'>[],
  deps: Pick<TodoDependency, 'dependencyId' | 'dependentId'>[],
  proposedEdges: { dependencyId: Id; dependentId: Id }[],
): boolean {
  const allDeps = deps.concat(proposedEdges);
  const g = buildGraph(todos, allDeps);
  try {
    topoSort(g);
    return false;
  } catch {
    return true;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday(): Date {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return n;
}

export async function recomputeSchedule() {
  const todos = await prisma.todo.findMany();
  const deps = await prisma.todoDependency.findMany();
  const g = buildGraph(todos, deps);
  const order = topoSort(g);

  // Maps for scheduling in days from today
  const duration = new Map<Id, number>();
  for (const t of todos) duration.set(t.id, Math.max(1, t.durationDays || 1));

  const ES = new Map<Id, number>(); // earliest start (days)
  const EF = new Map<Id, number>(); // earliest finish (days)

  for (const n of Array.from(order)) {
    const parents = Array.from((g.rev.get(n) || new Set<string>()) as Set<string>) as string[];
    const es = parents.length === 0 ? 0 : Math.max(...parents.map(p => (EF.get(p) ?? 0)));
    ES.set(n, es);
    EF.set(n, es + (duration.get(n) ?? 1));
  }

  const projectEnd = Math.max(0, ...Array.from(EF.values()));

  const LS = new Map<Id, number>(); // latest start (days)
  const LF = new Map<Id, number>(); // latest finish (days)

  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    const children = Array.from((g.adj.get(n) || new Set<string>()) as Set<string>) as string[];
    const lf = children.length === 0 ? projectEnd : Math.min(...children.map(c => (LS.get(c) ?? projectEnd)));
    LF.set(n, lf);
    LS.set(n, lf - (duration.get(n) ?? 1));
  }

  const today = startOfToday();
  const updates: Promise<any>[] = [];
  for (const t of Array.from(todos)) {
    const es = ES.get(t.id) ?? 0;
    const ef = EF.get(t.id) ?? es + (duration.get(t.id) ?? 1);
    const ls = LS.get(t.id) ?? es;
    const lf = LF.get(t.id) ?? ef;
    const slack = ls - es;
    const earliestStart = addDays(today, es);
    const earliestFinish = addDays(today, ef);
    const latestStart = addDays(today, ls);
    const latestFinish = addDays(today, lf);
    updates.push(
      prisma.todo.update({
        where: { id: t.id },
        data: {
          earliestStart,
          earliestFinish,
          latestStart,
          latestFinish,
          criticalPath: slack === 0,
        },
      })
    );
  }
  await Promise.all(updates);
}

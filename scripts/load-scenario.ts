import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { recomputeSchedule } from '../lib/scheduling';
import { finalize, printSummary, resetAll } from './util';

type Scenario = {
  tasks: { ref: string; title: string; durationDays?: number; dueDate?: string }[];
  dependencies?: { dependency: string; dependent: string }[];
  deletions?: string[];
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseDueDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const s = input.trim();
  const m = s.match(/^([+\-])(\d+)d$/i);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    const n = parseInt(m[2], 10) * sign;
    return addDays(startOfToday(), n);
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt;
  return undefined;
}

async function main() {
  const fileArg = process.argv[2] || 'scripts/scenarios/diamond.json';
  const filePath = path.resolve(process.cwd(), fileArg);
  const raw = fs.readFileSync(filePath, 'utf8');
  const scenario: Scenario = JSON.parse(raw);

  await resetAll();

  // create tasks and map refs to ids
  const refToId = new Map<string, string>();
  for (const t of scenario.tasks) {
    const created = await prisma.todo.create({
      data: {
        title: t.title,
        durationDays: t.durationDays && t.durationDays > 0 ? Math.floor(t.durationDays) : 1,
        dueDate: parseDueDate(t.dueDate),
      },
    });
    refToId.set(t.ref, created.id);
  }

  // dependencies
  if (scenario.dependencies?.length) {
    await prisma.todoDependency.createMany({
      data: scenario.dependencies.map((e) => ({
        dependencyId: refToId.get(e.dependency)!,
        dependentId: refToId.get(e.dependent)!,
      })),
    });
  }

  await recomputeSchedule();
  await printSummary('After load');

  // deletions
  if (scenario.deletions?.length) {
    for (const ref of scenario.deletions) {
      const id = refToId.get(ref);
      if (id) await prisma.todo.delete({ where: { id } });
    }
    await recomputeSchedule();
    await printSummary('After deletions');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(finalize);

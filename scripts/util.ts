import { prisma } from '../lib/prisma';
import { recomputeSchedule } from '../lib/scheduling';

export async function resetAll() {
  await prisma.todoDependency.deleteMany({});
  await prisma.todo.deleteMany({});
}

export async function printSummary(header = 'Summary') {
  const todos = await prisma.todo.findMany({
    orderBy: { createdAt: 'asc' },
    include: { dependencies: { include: { dependency: true } } },
  });
  console.log(`\n=== ${header} ===`);
  for (const t of todos) {
    const deps = t.dependencies.map((d) => d.dependency.title).join(', ') || 'None';
    const fmt = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
    const labels = [
      `Earliest start ${fmt(t.earliestStart)}`,
      `Earliest finish ${fmt(t.earliestFinish)}`,
      `Due ${fmt(t.dueDate)}`,
      t.criticalPath ? 'CRITICAL' : '',
    ].filter(Boolean);
    console.log(`- ${t.title} [effort ${t.durationDays}d] | ${labels.join(' | ')} | depends on: ${deps}`);
  }
}

export async function finalize() {
  await prisma.$disconnect();
}

export async function seedStandard() {
  const addDays = (days: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  };

  // Create tasks
  const A = await prisma.todo.create({ data: { title: 'A: Design', durationDays: 3, dueDate: addDays(10) } });
  const B = await prisma.todo.create({ data: { title: 'B: Backend', durationDays: 5, dueDate: addDays(15) } });
  const C = await prisma.todo.create({ data: { title: 'C: Frontend', durationDays: 4, dueDate: addDays(15) } });
  const D = await prisma.todo.create({ data: { title: 'D: Integration', durationDays: 2, dueDate: addDays(18) } });
  const E = await prisma.todo.create({ data: { title: 'E: QA', durationDays: 3, dueDate: addDays(21) } });

  // Dependencies: A->B, A->C, B->D, C->D, D->E
  await prisma.todoDependency.createMany({
    data: [
      { dependencyId: A.id, dependentId: B.id },
      { dependencyId: A.id, dependentId: C.id },
      { dependencyId: B.id, dependentId: D.id },
      { dependencyId: C.id, dependentId: D.id },
      { dependencyId: D.id, dependentId: E.id },
    ],
  });

  await recomputeSchedule();

  return { A, B, C, D, E };
}

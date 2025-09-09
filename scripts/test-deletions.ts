import { prisma } from '../lib/prisma';
import { finalize, printSummary, resetAll, seedStandard } from './util';
import { recomputeSchedule } from '../lib/scheduling';

async function main() {
  await resetAll();
  const { A, B, C, D, E } = await seedStandard();
  await printSummary('Initial');

  // Delete a middle dependency (C) and recompute
  await prisma.todo.delete({ where: { id: C.id } });
  await recomputeSchedule();
  await printSummary('After deleting C');

  // Delete the root (A) and recompute
  await prisma.todo.delete({ where: { id: A.id } });
  await recomputeSchedule();
  await printSummary('After deleting A');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(finalize);


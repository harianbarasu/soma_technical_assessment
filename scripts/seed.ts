import { finalize, printSummary, resetAll, seedStandard } from './util';

async function main() {
  await resetAll();
  await seedStandard();
  await printSummary('After seed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(finalize);


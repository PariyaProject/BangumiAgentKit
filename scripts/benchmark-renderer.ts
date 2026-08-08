import {
  RenderService,
  SubjectCardViewModel,
} from '../packages/renderer/dist/index.js';

async function benchmark() {
  console.log('=== Bangumi Agent Kit Renderer Benchmark ===\n');

  const vm: SubjectCardViewModel = {
    template: 'subject-card',
    version: 1,
    subject: {
      id: 1,
      name: 'Benchmark Subject',
      nameCn: '基准测试条目',
      type: 'anime',
      score: 9.0,
      summary: 'Benchmark summary text...',
      tags: ['Test', 'Benchmark'],
    },
    source: { label: 'Benchmark' },
  };

  // Cold start & first render
  const startCold = performance.now();
  const service = new RenderService();
  const resFirst = await service.renderCard(vm);
  const coldDuration = performance.now() - startCold;
  console.log(`Cold Browser Start + First Render: ${coldDuration.toFixed(2)} ms (${resFirst.buffer.length} bytes)`);

  // Warm render (uncached VM)
  const warmVm: SubjectCardViewModel = { ...vm, subject: { ...vm.subject, id: 2 } };
  const startWarm = performance.now();
  const resWarm = await service.renderCard(warmVm);
  const warmDuration = performance.now() - startWarm;
  console.log(`Warm Browser Render (uncached): ${warmDuration.toFixed(2)} ms (${resWarm.buffer.length} bytes)`);

  // Cache hit
  const startCache = performance.now();
  const resCache = await service.renderCard(warmVm);
  const cacheDuration = performance.now() - startCache;
  console.log(`Cache Hit Render: ${cacheDuration.toFixed(2)} ms (${resCache.buffer.length} bytes)`);

  // 10 concurrent renders
  const startConcurrent = performance.now();
  const concurrentTasks = Array.from({ length: 10 }).map((_, i) =>
    service.renderCard({ ...vm, subject: { ...vm.subject, id: 100 + i } }),
  );
  await Promise.all(concurrentTasks);
  const concurrentDuration = performance.now() - startConcurrent;
  console.log(`10 Concurrent Renders: ${concurrentDuration.toFixed(2)} ms (avg ${(concurrentDuration / 10).toFixed(2)} ms / card)`);

  await service.close();
  console.log('\nBenchmark completed successfully.');
}

benchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});

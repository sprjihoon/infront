// Direct comparison of seed128.ts SS tables vs pure JS reference
// We'll extract the constants by calling encrypt on specially crafted inputs

// Pure JS SEED128 (known correct - passes test vector)
// Import the pure version's SS tables and check specific values

// First, verify _seed-test-pure.mjs still passes
const { execSync } = await import('node:child_process');
const pure = execSync('node apps/web/scripts/_seed-test-pure.mjs', { cwd: 'C:\\Users\\one\\infront' }).toString();
console.log('Pure test result:', pure.split('\n').find(l => l.includes('PASS')));

// The key question: what are the SS1 and SS3 tables in seed128.ts?
// We can probe this by constructing inputs that hit specific table entries.

// Let's compare outputs for simple single-block inputs to narrow down differences.
// If the round key computation is the same, different SS table entries will cause differences.

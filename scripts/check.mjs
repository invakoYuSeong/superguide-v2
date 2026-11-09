// Runs every check: engine parity with the legacy results, then unit/integrity tests.
await import('./test-parity.mjs');
await import('./test-units.mjs');
await import('./test-structures.mjs');
await import('./test-personal.mjs');
await import('./test-anatomy.mjs');
await import('./test-support.mjs');
await import('./test-warbonds.mjs');
await import('./test-warbond-detail.mjs');
await import('./test-armor.mjs');
await import('./test-attachments.mjs');
await import('./test-i18n.mjs');

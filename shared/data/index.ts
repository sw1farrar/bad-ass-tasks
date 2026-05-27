/**
 * Shared data layer barrel (M0 prep).
 *
 * Ultimate target: hybridStore.ts + mappers, queue, JSONB adapters, repositories
 * moved/refactored here from lib/data/hybridStore.ts (core strength, heavily guarded).
 *
 * All public APIs MUST keep 100% isSupabaseLive() + demo ID ("w1"/"w2") guards.
 * NO changes to guards without formal proposal + full audit.
 *
 * Current: lib/data/hybridStore.ts remains source of truth.
 */

export {};

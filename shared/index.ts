/**
 * Shared cross-cutting concerns barrel (2026 architecture).
 *
 * ui/, data/, state/, types/, utils/, components/, supabase/
 *
 * This provides stable contracts for features/ to depend on.
 * Features import from here or directly from sub for colocation.
 *
 * M0 prep: skeleton barrels only. No moves performed.
 */

export * from './ui';
export * from './data';
export * from './state';
export * from './types';
export * from './utils';
export * from './components';
export * from './supabase';

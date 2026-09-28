/**
 * Shared types of the crypto kit (PLAN §3.11). The kit is PURE: every module under src/crypto/ imports only
 * src/engine and src/lib/rng, except the *.worker.ts and *Client.ts files, which only chapters' views use.
 *
 * Conventions used throughout the kit:
 *  - letters are uppercase `Letter`s and their indices (A = 0); permutations are engine `Perm`s;
 *  - products follow the engine's left-to-right composition: AD = compose(A, D) sends the 1st indicator letter
 *    to the 4th;
 *  - crib positions are 1-based (`MenuEdge.pos`, `scramblerAt(…, pos)`), offsets into the cipher are 0-based.
 */

/** A random source returning floats in [0, 1) (the same shape as lib/rng's `Rng`; use `createRng(seed)`). */
export type Rng = () => number

/**
 * The three products observed from a day's doubled indicators: AD[x] is the 4th letter of every indicator whose
 * 1st letter is x (BE: 2nd → 5th, CF: 3rd → 6th), or null while no indicator shows x. Conflicting observations
 * are resolved by majority and listed once per rejected mapping, e.g. 'CF: Z→W vs X→W'.
 */
export interface Products {
  readonly AD: readonly (number | null)[]
  readonly BE: readonly (number | null)[]
  readonly CF: readonly (number | null)[]
  readonly conflicts: readonly string[]
}

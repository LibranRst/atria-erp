type CommitEffect = () => void;
type TransactionRunner<TTransaction extends object, TConfig> = <TResult>(
  work: (transaction: TTransaction) => Promise<TResult>,
  config?: TConfig,
) => Promise<TResult>;

const effectsByTransaction = new WeakMap<object, Map<string, CommitEffect>>();

/** Unmanaged fixture/CLI transactions keep their durable outbox for the scheduler. */
export function registerCommitEffect(
  transaction: object,
  key: string,
  effect: CommitEffect,
): boolean {
  const effects = effectsByTransaction.get(transaction);
  if (!effects) return false;
  if (!effects.has(key)) effects.set(key, effect);
  return true;
}

/** Native transaction resolution includes COMMIT; rejection never releases effects. */
export function withCommitEffects<TTransaction extends object, TConfig>(
  runTransaction: TransactionRunner<TTransaction, TConfig>,
  reportEffectError: (error: unknown) => void,
): TransactionRunner<TTransaction, TConfig> {
  return async function run<TResult>(
    work: (transaction: TTransaction) => Promise<TResult>,
    config?: TConfig,
  ): Promise<TResult> {
    const effects = new Map<string, CommitEffect>();
    let currentTransaction: TTransaction | undefined;
    try {
      const result = await runTransaction(async (transaction) => {
        currentTransaction = transaction;
        effectsByTransaction.set(transaction, effects);
        return work(transaction);
      }, config);

      if (currentTransaction) effectsByTransaction.delete(currentTransaction);
      for (const effect of effects.values()) {
        try {
          effect();
        } catch (error) {
          // The business write is already committed; notification failure cannot undo it.
          try {
            reportEffectError(error);
          } catch {
            // Reporting failure must not turn a committed payment into an apparent failure.
          }
        }
      }
      return result;
    } finally {
      if (currentTransaction) effectsByTransaction.delete(currentTransaction);
    }
  };
}

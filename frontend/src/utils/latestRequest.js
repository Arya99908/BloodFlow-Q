/** Only the newest request may publish state. Invalidating also guards unmount. */
export function createLatestRequest() {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    async run(load, { start, success, failure, finish }) {
      const current = ++generation;
      start();
      try {
        const value = await load();
        if (current === generation) success(value);
      } catch (error) {
        if (current === generation) failure(error);
      } finally {
        if (current === generation) finish();
      }
    },
  };
}

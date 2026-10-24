/** Resolve only after the browser confirms the clipboard write. */
export async function copyText(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select and copy the displayed ID manually.');
  try { await clipboard.writeText(text); }
  catch { throw new Error('The browser could not copy the ID. Select and copy the displayed ID manually.'); }
}

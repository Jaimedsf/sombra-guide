/**
 * Shares `url` through the system share sheet when `share` is given (phones), else copies it.
 * Resolves to what happened: 'shared', 'cancelled' (sheet closed), 'copied' or 'failed'.
 */
export async function shareLink(url, { share, copy }) {
  if (share) {
    try {
      await share({ title: 'Sombra Guide', url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // the sheet can't open here (e.g. not allowed): copying still works
    }
  }
  try {
    await copy(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

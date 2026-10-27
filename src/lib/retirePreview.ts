const PREVIEW_KEY = 'table-talk-record-preview-v1';

/** Retire only the isolated visual-preview data, never ordinary local or cloud games. */
export function retireRecordPreview() {
  let hadPreview = false;
  try {
    hadPreview = sessionStorage.getItem(PREVIEW_KEY) !== null;
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch { /* Storage can be disabled. The application no longer uses preview mode. */ }
  try {
    hadPreview = localStorage.getItem(PREVIEW_KEY) !== null || hadPreview;
    localStorage.removeItem(PREVIEW_KEY);
  } catch { /* Do not block the shared table when local storage is disabled. */ }
  const url = new URL(window.location.href);
  const previewParam = ['records', 'off'].includes(url.searchParams.get('demo') ?? '');
  if (!hadPreview && !previewParam) return;
  if (previewParam) url.searchParams.delete('demo');
  if (/^\/(rivalry\/records-|game\/demo-)/.test(url.pathname)) {
    url.pathname = '/';
    url.searchParams.delete('record');
    url.hash = '';
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

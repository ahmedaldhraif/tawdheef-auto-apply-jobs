/** Native API transport. The public demo replaces this module at build time. */
export async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const error = new Error(data?.error || 'This action could not finish.');
    error.status = res.status;
    throw error;
  }
  return data;
}

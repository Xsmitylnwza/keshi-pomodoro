/**
 * Local-only mock session helpers.
 * Enabled automatically in Vite DEV unless VITE_LOCAL_MOCK_AUTH=false.
 */
export const LOCAL_MOCK_USER = {
  id: 'local-demo',
  email: 'demo@localhost',
  name: 'Local Demo',
  avatarUrl: undefined as string | undefined,
};

export function isLocalMockAuthEnabled() {
  if (!import.meta.env.DEV) return false;
  const flag = import.meta.env.VITE_LOCAL_MOCK_AUTH;
  if (typeof flag === 'string' && ['0', 'false', 'no', 'off'].includes(flag.trim().toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Desktop (Tauri) configuration helpers.
 *
 * Provides functions to read/write the backend server URL from the Tauri
 * persistent config store.  All functions are safe to call in a plain
 * browser context – they return null / no-op when not running inside Tauri.
 */

import { invoke, isTauri } from '@tauri-apps/api/core';

// Re-export for convenience — other modules import isTauri from this module
export { isTauri };

// ---------------------------------------------------------------------------
// Backend URL persistence
// ---------------------------------------------------------------------------

/**
 * Returns the stored backend server URL, or `null` if:
 *  - not running in Tauri, or
 *  - no URL has been configured yet.
 */
export async function getBackendUrl(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<string | null>('get_backend_url');
  } catch {
    return null;
  }
}

/**
 * Persists the backend server URL in the Tauri config store.
 * No-op when not running in Tauri.
 */
export async function setBackendUrl(url: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('set_backend_url', { url });
}

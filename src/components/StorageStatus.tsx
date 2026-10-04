import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/session'

export function StorageStatus() {
  const [persistent, setPersistent] = useState(false)
  const [usage, setUsage] = useState<number | undefined>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const supported = typeof navigator.storage?.persist === 'function'

  useEffect(() => {
    let cancelled = false
    async function inspect() {
      try {
        const [kept, estimate] = await Promise.all([navigator.storage?.persisted?.(), navigator.storage?.estimate?.()])
        if (!cancelled) { setPersistent(kept ?? false); setUsage(estimate?.usage) }
      } catch { /* Storage estimates are optional; collection still uses IndexedDB. */ }
    }
    void inspect()
    return () => { cancelled = true }
  }, [])

  async function protect() {
    setBusy(true)
    try {
      const granted = await navigator.storage.persist()
      setPersistent(granted)
      setMessage(granted ? 'The browser granted storage protection. Keep exporting backups too.' : 'The browser did not grant storage protection. Your samples are still saved; export backups regularly.')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setBusy(false) }
  }

  return <section className="storage-status"><h2>Keep your collection safe</h2>
    <p>Characters and expressions are saved to this laptop in the project data folder. The browser keeps a working copy so the iPad can collect through ngrok. Export Dataset in the review page for an additional backup.</p>
    <p>{persistent ? 'Browser storage protection is enabled.' : 'Browser storage can be cleared. Regular JSON backups protect your work.'}{usage !== undefined ? ` About ${(usage / 1024 / 1024).toFixed(1)} MB used by this app.` : ''}</p>
    {supported && !persistent && <button disabled={busy} onClick={() => void protect()}>{busy ? 'Requesting…' : 'Protect browser storage'}</button>}
    {!supported && <p>Extra browser storage protection is unavailable at this address. Saving and exporting samples still work.</p>}
    {message && <p role="status">{message}</p>}
  </section>
}

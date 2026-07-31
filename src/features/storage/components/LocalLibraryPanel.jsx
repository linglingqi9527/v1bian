import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCcw } from 'lucide-react'
import { SketchButton } from '../../../design-system/ui/SketchButton.jsx'
import { ANALYTICS_EVENTS, track } from '../../analytics/index.js'
import {
  chooseLocalLibrary,
  getLocalLibraryUnsupportedMessage,
  getSavedLocalLibraryStatus,
  reconnectSavedLocalLibrary,
} from '../localLibraryService.js'
import './LocalLibraryPanel.css'

const initialStatus = {
  canReconnect: false,
  connected: false,
  directoryName: '',
  message: '',
  meta: null,
  permission: 'prompt',
  supported: true,
}

export function LocalLibraryPanel() {
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState(initialStatus)

  useEffect(() => {
    let isMounted = true

    getSavedLocalLibraryStatus()
      .then((nextStatus) => {
        if (isMounted) setStatus(nextStatus)
      })
      .catch((nextError) => {
        if (isMounted) setError(nextError.message)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleChooseLibrary() {
    await runLibraryAction(() => chooseLocalLibrary(), 'choose')
  }

  async function handleReconnectLibrary() {
    await runLibraryAction(() => reconnectSavedLocalLibrary(), 'reconnect')
  }

  async function runLibraryAction(action, source) {
    setError('')
    setIsBusy(true)

    try {
      const nextStatus = await action()
      setStatus(nextStatus)
      if (nextStatus.connected) {
        track(ANALYTICS_EVENTS.LOCAL_LIBRARY_CONNECTED, {
          connected: true,
          success: true,
        })
      }
    } catch (nextError) {
      setError(nextError.message)
      track(ANALYTICS_EVENTS.LOCAL_LIBRARY_CONNECTION_FAILED, {
        connected: false,
        errorCode: nextError?.name || 'library_connection_failed',
        errorType: source,
        success: false,
      })
    } finally {
      setIsBusy(false)
    }
  }

  const unsupportedMessage = status.supported ? '' : getLocalLibraryUnsupportedMessage()

  return (
    <section className="local-library-panel">
      <div>
        <p className="local-library-panel__eyebrow">网页端本地资料包</p>
        <h2>辩了么资料包</h2>
        <p>
          选择一个本地文件夹后，后续收藏、赛评、训练和音视频会逐步写入这个资料包。
          当前阶段只负责连接和初始化，不迁移已有数据。
        </p>
      </div>

      <div className="local-library-status">
        <StatusRow label="浏览器支持" value={status.supported ? '支持' : '不支持'} />
        <StatusRow label="连接状态" value={status.connected ? '已连接' : '未连接'} />
        {status.directoryName ? <StatusRow label="资料包文件夹" value={status.directoryName} /> : null}
        {status.meta?.schemaVersion ? <StatusRow label="结构版本" value={`v${status.meta.schemaVersion}`} /> : null}
        {status.meta?.libraryId ? <StatusRow label="资料包 ID" value={status.meta.libraryId} /> : null}
      </div>

      {(unsupportedMessage || error || status.message) ? (
        <p className="local-library-message" role="status">
          {unsupportedMessage || error || status.message}
        </p>
      ) : null}

      <div className="local-library-actions">
        <SketchButton disabled={!status.supported || isBusy} onClick={handleChooseLibrary} type="button">
          <FolderOpen size={18} />
          选择资料包
        </SketchButton>
        <SketchButton
          disabled={!status.supported || !status.canReconnect || isBusy}
          onClick={handleReconnectLibrary}
          type="button"
          variant="secondary"
        >
          <RefreshCcw size={18} />
          重新连接
        </SketchButton>
      </div>
    </section>
  )
}

function StatusRow({ label, value }) {
  return (
    <div className="local-library-status__row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

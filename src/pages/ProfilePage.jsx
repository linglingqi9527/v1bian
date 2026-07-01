import { useEffect, useState } from 'react'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { PageHeader } from '../design-system/layout/PageHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchCard } from '../design-system/ui/SketchCard.jsx'
import {
  AUTH_UPDATED_EVENT,
  getAuthSnapshot,
  loginDeveloperUser,
  loginLocalUser,
  logoutCurrentUser,
} from '../features/auth/authService.js'
import { LocalLibraryPanel } from '../features/storage/components/LocalLibraryPanel.jsx'
import './ProfilePage.css'

export default function ProfilePage() {
  const [authSnapshot, setAuthSnapshot] = useState(() => getAuthSnapshot())
  const [error, setError] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [developerPassword, setDeveloperPassword] = useState('')
  const [developerOpen, setDeveloperOpen] = useState(false)

  useEffect(() => {
    function handleAuthUpdated() {
      setAuthSnapshot(getAuthSnapshot())
    }

    window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated)
    return () => window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated)
  }, [])

  async function handleLocalLogin(event) {
    event.preventDefault()
    setError('')

    try {
      setAuthSnapshot(await loginLocalUser(account, password))
      setAccount('')
      setPassword('')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  async function handleDeveloperLogin(event) {
    event.preventDefault()
    setError('')

    try {
      setAuthSnapshot(await loginDeveloperUser(developerPassword))
      setDeveloperPassword('')
    } catch (nextError) {
      setError(nextError.message)
    }
  }

  function handleLogout() {
    setError('')
    setAuthSnapshot(logoutCurrentUser())
  }

  const description = authSnapshot.developerLoggedIn
    ? '当前正在读取开发者调试数据，用来验证交互逻辑。'
    : authSnapshot.localLoggedIn
      ? '当前正在使用本地身份。后续连接资料包后，个人数据会写入本地资料包。'
      : '未登录时展示纯净比赛库，不读取任何个人收藏、赛评和训练。'

  return (
    <ContentLayout>
      <PageHeader
        eyebrow="本地身份"
        title="登录"
        description={description}
      />
      <SketchCard>
        {authSnapshot.loggedIn ? (
          <div className="profile-login-panel">
            <h2>{authSnapshot.developerLoggedIn ? '开发者调试入口' : '已登录本地身份'}</h2>
            <p>当前身份：{authSnapshot.activeDisplayName || authSnapshot.activeUserId}</p>
            <p>
              {authSnapshot.developerLoggedIn
                ? '这里读取 demo-user 的调试数据，适合继续验证收藏、赛评、训练等交互是否成立。'
                : '这是普通用户身份。后续选择资料包后，收藏、赛评、训练和音视频会逐步写入资料包。'}
            </p>
            <SketchButton onClick={handleLogout} type="button" variant="secondary">退出登录</SketchButton>
          </div>
        ) : (
          <div className="profile-login-stack">
            <form className="profile-login-panel" onSubmit={handleLocalLogin}>
              <h2>本地身份登录</h2>
              <p>输入账号和密码。新账号会在这台浏览器里创建；已有账号会校验密码后进入。</p>
              <div className="profile-login-fields">
                <label className="profile-login-field">
                  <span>账号</span>
                  <input
                    onChange={(event) => setAccount(event.target.value)}
                    placeholder="给自己取一个账号"
                    type="text"
                    value={account}
                  />
                </label>
                <label className="profile-login-field">
                  <span>密码</span>
                  <input
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="输入密码"
                    type="password"
                    value={password}
                  />
                </label>
              </div>
              {error ? <strong className="profile-login-error">{error}</strong> : null}
              <SketchButton type="submit">进入本地身份</SketchButton>
            </form>
            <div className="developer-entry">
              <button
                className="developer-entry__toggle"
                onClick={() => setDeveloperOpen((value) => !value)}
                type="button"
              >
                开发者入口
              </button>
              {developerOpen ? (
                <form className="developer-entry__form" onSubmit={handleDeveloperLogin}>
                  <label className="profile-login-field">
                    <span>开发者密码</span>
                    <input
                      onChange={(event) => setDeveloperPassword(event.target.value)}
                      placeholder="输入开发者密码"
                      type="password"
                      value={developerPassword}
                    />
                  </label>
                  <SketchButton type="submit" variant="secondary">进入调试数据</SketchButton>
                </form>
              ) : null}
            </div>
          </div>
        )}
      </SketchCard>
      <SketchCard>
        <LocalLibraryPanel />
      </SketchCard>
    </ContentLayout>
  )
}

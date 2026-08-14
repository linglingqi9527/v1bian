import { HandDrawnArrow } from '../handdrawn/HandDrawnArrow.jsx'

export function MobileOrientationNotice({ isVisible, onRequestLandscape }) {
  return (
    <section
      className={`mobile-orientation-notice${isVisible ? ' mobile-orientation-notice--visible' : ''}`}
      role="status"
      aria-label="手机横屏浏览提示"
    >
      <div className="mobile-orientation-notice__visual">
        <button
          className="mobile-orientation-notice__action"
          onClick={onRequestLandscape}
          type="button"
          aria-label="手动切换为横屏布局"
        >
          <span>点击</span>
          <HandDrawnArrow className="mobile-orientation-notice__arrow" variant="turn" />
        </button>
        <div className="mobile-orientation-notice__phone" aria-hidden="true" />
      </div>
      <strong>请点击旋转横屏浏览</strong>
      <p>横屏后会自动进入，也可点击蓝色箭头手动切换</p>
    </section>
  )
}

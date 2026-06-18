import { NavLink } from 'react-router'
import { imageAssets } from '../../assets/assetPaths.js'
import { HandDrawnAnimatedFill } from '../handdrawn/HandDrawnAnimatedFill.jsx'

const navItems = [
  { to: '/matches', label: '比赛', icon: imageAssets.nav.watchMatch },
  { to: '/reviews', label: '赛评', icon: imageAssets.nav.writeReview },
  { to: '/trainings', label: '训练', icon: imageAssets.nav.startTraining },
  { to: '/profile', label: '我的', icon: imageAssets.logoMark },
]

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to}>
          {({ isActive }) => (
            <>
              {isActive ? <HandDrawnAnimatedFill tone="current" /> : null}
              <img src={item.icon} alt="" />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

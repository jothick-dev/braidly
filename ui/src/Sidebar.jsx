import { Home, User, LayoutDashboard, FolderKanban, Users, Info, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Project', icon: FolderKanban },
  { id: 'team', label: 'Team', icon: Users },
]

export default function Sidebar({ user, activeTab, onTabChange, onSignOut }) {
  const [collapsed, setCollapsed] = useState(false)
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Guest'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <aside
      className={`h-screen flex flex-col bg-ink border-r border-border flex-shrink-0 transition-all duration-200 ${
        collapsed ? 'w-[60px]' : 'w-56'
      }`}
    >
      {/* User avatar */}
      <div className={`p-3 border-b border-border flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-9 h-9 rounded-full bg-accent text-ink flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initial}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text truncate">{displayName}</p>
            <p className="text-[10px] text-text-dim truncate">{user?.email || 'guest@local'}</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-dim hover:text-text hover:bg-surface-hover'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-2 space-y-0.5">
        {/* About */}
        <button
          className={`w-full flex items-center gap-2.5 rounded-lg text-xs text-text-dim hover:text-text hover:bg-surface-hover transition-colors ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          }`}
          title={collapsed ? 'About' : undefined}
        >
          <Info size={16} className="flex-shrink-0" />
          {!collapsed && <span>About</span>}
        </button>

        {/* Sign out */}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className={`w-full flex items-center gap-2.5 rounded-lg text-xs text-red/80 hover:text-red hover:bg-red/10 transition-colors ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            }`}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 text-text-dim hover:text-text transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Branding */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="text-accent text-xs">⬡</span>
            <span className="text-[10px] font-bold text-text-dim">Braidly</span>
          </div>
          <p className="text-[9px] text-text-dim/60 mt-0.5">AI Team Workspace</p>
        </div>
      )}
    </aside>
  )
}

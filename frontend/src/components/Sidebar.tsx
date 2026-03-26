import { NavLink, useNavigate } from 'react-router-dom';
import { FileText, Calendar, CheckSquare, LogOut, Sparkles, X, Coffee, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SidebarProps {
  onClose?: () => void;
}

const navItems = [
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/todos', icon: CheckSquare, label: 'To Do' },
  { to: '/coffee', icon: Coffee, label: 'Coffee Timer' },
];

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="flex flex-col w-64 h-full bg-surface border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-primary rounded-xl shadow-warm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-text-primary">LifePlanner</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* User Profile */}
      {user && (
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl">
            <div className="flex items-center justify-center w-9 h-9 bg-primary/20 rounded-full flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {getInitials(user.username)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {user.username}
              </p>
              <p className="text-xs text-text-secondary truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-3">
          Menu
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : ''}`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Settings + Logout */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import { ClipboardList, ClipboardCheck, LayoutDashboard, Trophy, Users, UserCog, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "./Dialog";
import Logo from "./Logo";


const links = [
  { to: "/", label: "Repairs", icon: ClipboardList, end: true },
  { to: "/to-verify", label: "To Verify", icon: ClipboardCheck, roles: ["admin", "user"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/team", label: "Team", icon: Users, roles: ["admin"] },
  { to: "/account", label: "Account", icon: UserCog },
];

export default function Layout() {
  const { profile, logout } = useAuth();
  const { confirm } = useDialog();
  const visible = links.filter((l) => !l.roles || l.roles.includes(profile.role));

  async function handleLogout() {
    const ok = await confirm({
      title: "Sign out?",
      message: "You'll need to sign in again to continue.",
      confirmText: "Sign out",
      tone: "warning",
    });
    if (ok) logout();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={40} />
          <span className="brand-text">GRM Repair</span>
        </div>

        <nav className="nav">
          {visible.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link" title={label}>
              <Icon size={19} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="user-box">
          <div className="avatar">{profile.name?.[0]?.toUpperCase() || "?"}</div>
          <div className="user-info">
            <strong>{profile.name}</strong>
            <span className="role">{profile.role}</span>
          </div>
          <button className="icon-btn" onClick={handleLogout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className="mobile-top">
        <div className="brand">
          <Logo size={34} />
          <span className="brand-text">GRM Repair</span>
        </div>
        <button className="icon-btn" onClick={handleLogout} title="Sign out">
          <LogOut size={20} />
        </button>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {visible.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tab">
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
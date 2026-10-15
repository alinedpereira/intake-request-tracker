import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { ClipboardList, ClipboardCheck, FilePlus2, FileSearch, LayoutDashboard, LifeBuoy, ListChecks } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "My requests", icon: ClipboardList, roles: ["Requestor", "Assignee", "Manager"] },
  { to: "/requests", label: "Request details", icon: FileSearch, roles: ["Requestor", "Assignee", "Manager"] },
  { to: "/new", label: "New request", icon: FilePlus2, roles: ["Requestor", "Assignee", "Manager"] },
  { to: "/work", label: "Request & tasks", icon: ClipboardCheck, roles: ["Assignee", "Manager"] },
  { to: "/tasks", label: "Tasks", icon: ListChecks, roles: ["Assignee", "Manager"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Manager"] },
  { to: "/help", label: "Help", icon: LifeBuoy, roles: ["Requestor", "Assignee", "Manager"] },
] as const;

const ROLES: Role[] = ["Requestor", "Assignee", "Manager"];

export function AppShell() {
  const { pathname } = useLocation();
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const items = NAV.filter((n) => (n.roles as readonly string[]).includes(role));

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[oklch(0.27_0.07_262)] px-5 py-3 text-white">
        <p className="text-lg tracking-tight">
          <span className="font-semibold">Intake</span> Request Tracker
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="role-switch" className="text-sm text-white/90">
            View as
          </label>
          <select
            id="role-switch"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 rounded-full border-0 bg-[oklch(0.47_0.16_265)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="text-foreground">
                {r}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav aria-label="Primary" className="border-b border-border bg-muted/60 md:w-56 md:shrink-0 md:border-b-0 md:border-r">
          <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:py-4">
            {items.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" || pathname.startsWith("/intakes") : pathname.startsWith(to);
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 whitespace-nowrap rounded-md border-l-4 border-transparent px-3 py-2.5 text-sm text-foreground/80 hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring",
                      active && "border-primary bg-accent font-semibold text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col bg-background">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex-1"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default AppShell;

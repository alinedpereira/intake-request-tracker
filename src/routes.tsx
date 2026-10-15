import type { ReactElement } from "react";
import { ClipboardList, FilePlus2, LayoutDashboard, LifeBuoy, type LucideIcon } from "lucide-react";
import { HomePage } from "@/pages/home";
import { NewRequestPage } from "@/pages/new-request";
import { RequestDetailPage } from "@/pages/request-detail";
import { DashboardPage } from "@/pages/dashboard";
import { HelpPage } from "@/pages/help";
import { MyIntakesPage } from "@/pages/my-intakes";
import { TasksPage } from "@/pages/tasks";

export interface AppRoute {
  path: string;
  element: ReactElement;
  label?: string;
  icon?: LucideIcon;
}

export const routes: AppRoute[] = [
  { path: "/", element: <HomePage />, label: "My requests", icon: ClipboardList },
  { path: "/new", element: <NewRequestPage />, label: "New request", icon: FilePlus2 },
  { path: "/intakes", element: <MyIntakesPage /> },
  { path: "/requests", element: <RequestDetailPage /> },
  { path: "/requests/:id", element: <RequestDetailPage /> },
  { path: "/work", element: <RequestDetailPage withTasks /> },
  { path: "/work/:id", element: <RequestDetailPage withTasks /> },
  { path: "/tasks", element: <TasksPage /> },
  { path: "/dashboard", element: <DashboardPage />, label: "Dashboard", icon: LayoutDashboard },
  { path: "/help", element: <HelpPage />, label: "Help", icon: LifeBuoy },
];

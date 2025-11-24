import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Inbox,
  Users as UsersIcon, 
  Building2, 
  TrendingUp, 
  FileText,
  Settings,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import ProfileEditDialog from "@/components/ProfileEditDialog";

const navigationIcons = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Contatos", href: "/contacts", icon: UsersIcon },
  { name: "Organizações", href: "/organizations", icon: Building2 },
  { name: "Negócios", href: "/deals", icon: TrendingUp },
  { name: "Formulários", href: "/forms", icon: FileText },
];

export function IconSidebar() {
  const location = useLocation();
  const { isAdmin, loading } = useUserRole();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  return (
    <aside className="w-20 bg-[#050505] border-r border-[#27272A] flex flex-col items-center py-6">
      {/* Logo */}
      <div className="mb-8 flex items-center justify-center w-12 h-12 rounded-2xl bg-[#4ADE80]">
        <span className="text-2xl font-bold text-black">C</span>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col gap-4">
        {navigationIcons.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200",
                isActive
                  ? "bg-[#4ADE80] text-black shadow-lg shadow-[#4ADE80]/50"
                  : "text-[#999999] hover:bg-[#1A1A1A] hover:text-white"
              )}
              title={item.name}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
        
        {loading ? (
          <Skeleton className="h-12 w-12 rounded-2xl" />
        ) : isAdmin && (
          <Link
            to="/users"
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200",
              location.pathname === "/users"
                ? "bg-[#4ADE80] text-black shadow-lg shadow-[#4ADE80]/50"
                : "text-[#999999] hover:bg-[#1A1A1A] hover:text-white"
            )}
            title="Usuários"
          >
            <UserCog className="h-5 w-5" />
          </Link>
        )}
      </nav>

      {/* Settings at bottom */}
      <ProfileEditDialog
        trigger={
          <button className="flex items-center justify-center w-12 h-12 rounded-2xl text-[#999999] hover:bg-[#1A1A1A] hover:text-white transition-all duration-200">
            <Settings className="h-5 w-5" />
          </button>
        }
      />
    </aside>
  );
}

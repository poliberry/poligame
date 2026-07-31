import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleUser, Library, MessageSquare, ShoppingBag, User, Users } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "./ui/button";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: "/", label: "Library", icon: <Library size={20} /> },
  { path: "/community", label: "Community", icon: <Users size={20} /> },
  { path: "/profile", label: "Profile", icon: <CircleUser size={20} /> },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const {} = useAuthStore();

  return (
    <>
      <div className="flex flex-row items-center justify-center w-full z-50">
        <nav className="flex flex-row w-fit items-center gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  className={`p-3 flex flex-row items-center no-underline min-w-fit rounded-full hover:bg-[var(--theme-button)]/40 cursor-pointer ${isActive ? "text-[var(--theme-accent)] bg-[var(--theme-button)]" : "text-muted-foreground hover:text-[var(--theme-accent)]"}`}
                >
                  <span>{item.icon}</span>
                  <span
                    className={`font-light text-sm`}
                  >
                    {item.label}
                  </span>
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};

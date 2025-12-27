import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Library, MessageSquare, ShoppingBag, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "./ui/button";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: "/", label: "Library", icon: <Library size={20} /> },
  { path: "/community", label: "Community", icon: <MessageSquare size={20} /> },
  { path: "/marketplace", label: "Marketplace", icon: <ShoppingBag size={20} /> },
  { path: "/profile", label: "Profile", icon: <User size={20} /> },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { } = useAuthStore();


  return (
    <>
      <div className="flex flex-row w-full z-50">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&display=swap" rel="stylesheet"></link>
        <nav className="flex flex-row w-full items-center -ml-0.5 -mb-0.25">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
              >
                <Button variant="ghost" className={`p-3 flex flex-row items-center min-w-fit cursor-pointer ${isActive ? 'border-t-[var(--theme-button)] border-t-2 text-foreground': 'border-t-muted border-t-2 text-muted-foreground hover:text-foreground hover:border-t-[var(--theme-button)]'}`}>
                  <span>{item.icon}</span>
                  <span className={`uppercase text-sm italic`} style={{ fontFamily: 'Unbounded, sans-serif' }}>{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
};


import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Moon, Sun, LogOut, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { key: "overview", label: "Overview", href: "/overview" },
  { key: "college",  label: "College",  href: "/college" },
  { key: "alts",     label: "Alts",     href: "/alts" },
  { key: "equity",   label: "Equity",   href: null },
  { key: "property", label: "Property", href: null },
];

function useAppTheme() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark")
  );

  function applyTheme(dark) {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
    setIsDark(dark);
  }

  return [isDark, () => applyTheme(!isDark)];
}

export function AppHeader({ user, onSignOut, onShareClick, saveStatus }) {
  const location = useLocation();
  const [isDark, toggleDark] = useAppTheme();

  // Derive active tab from current route
  const currentKey = NAV.find((n) => n.href && location.pathname.startsWith(n.href))?.key ?? null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Brand */}
        <Link
          to="/"
          className="font-heading font-bold text-lg tracking-tight text-foreground hover:text-primary transition-colors shrink-0"
        >
          Holistic
        </Link>

        <Separator orientation="vertical" className="h-5" />

        {/* Nav tabs */}
        <nav className="flex items-center gap-1" aria-label="Module navigation">
          {NAV.map((tab) => {
            const isActive = tab.key === currentKey;
            const isBuilt = tab.href !== null;

            if (!isBuilt) {
              return (
                <Tooltip key={tab.key}>
                  <TooltipTrigger asChild>
                    <span
                      className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground/40 cursor-default select-none"
                      aria-disabled="true"
                    >
                      {tab.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Coming soon</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={tab.key}
                to={tab.href}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus}
            </span>
          )}

          {onShareClick && (
            <Button variant="ghost" size="icon" onClick={onShareClick} aria-label="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user && (
            <>
              <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[160px]">
                {user.email}
              </span>
              <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

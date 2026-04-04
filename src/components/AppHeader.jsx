import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Moon, Sun, LogOut, Share2, UserCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/useProfile";

const NAV = [
  { key: "overview", label: "Overview", href: "/overview" },
  { key: "college", label: "College", href: "/college" },
  { key: "alts", label: "Alts", href: "/alts" },
  { key: "dividends", label: "Dividends", href: "/dividends" },
  { key: "equity", label: "Equity", href: null },
  { key: "property", label: "Property", href: null },
];

function useAppTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  function applyTheme(dark) {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
    setIsDark(dark);
  }

  return [isDark, () => applyTheme(!isDark)];
}

function Avatar({ profile }) {
  if (!profile) return <UserCircle className="h-5 w-5" />;
  if (profile.photoURL) {
    return (
      <img
        src={profile.photoURL}
        alt={profile.displayName}
        className="w-6 h-6 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold font-heading">
      {profile.displayName?.[0] ?? "?"}
    </div>
  );
}

export function AppHeader({ user, onSignOut, onShareClick, saveStatus, minimal = false }) {
  const location = useLocation();
  const [isDark, toggleDark] = useAppTheme();
  const { profile } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentKey =
    NAV.find((n) => n.href && location.pathname.startsWith(n.href))?.key ?? null;

  // Close mobile menu on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

        {!minimal && <Separator orientation="vertical" className="h-5" />}

        {/* Desktop nav tabs — hidden on mobile, hidden in minimal mode */}
        {!minimal && <nav className="hidden sm:flex items-center gap-1" aria-label="Module navigation">
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
        </nav>}

        {/* Mobile hamburger — visible only on mobile, not in minimal mode */}
        {!minimal && (
          <Button
            variant="ghost"
            size="icon"
            className="flex sm:hidden"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-muted-foreground hidden sm:inline mr-2">
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : saveStatus}
            </span>
          )}

          {onShareClick && (
            <Button variant="ghost" size="icon" onClick={onShareClick} aria-label="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                    aria-label="Profile settings"
                  >
                    <Avatar profile={profile} />
                    <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[140px]">
                      {profile?.displayName || user.email}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Profile &amp; settings</p>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="icon"
                onClick={onSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {!minimal && mobileMenuOpen && (
        <nav
          className="flex sm:hidden flex-col border-t bg-background/95 backdrop-blur"
          aria-label="Mobile navigation"
        >
          {NAV.map((tab) => {
            const isActive = tab.key === currentKey;
            const isBuilt = tab.href !== null;

            if (!isBuilt) {
              return (
                <span
                  key={tab.key}
                  className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground/40 cursor-default"
                >
                  {tab.label}
                  <span className="text-xs">Coming soon</span>
                </span>
              );
            }

            return (
              <Link
                key={tab.key}
                to={tab.href}
                className={[
                  "px-4 py-3 text-sm font-medium transition-colors",
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
      )}
    </header>
  );
}

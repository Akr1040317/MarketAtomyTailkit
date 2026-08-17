import { useEffect, useRef, useState } from "react";
import companyLogo from "../assets/MarketAtomy-HOR-300x92.png";
import { useTheme } from "../utils/theme";
import "../assets/workspace-chrome.css";

function SunIcon() {
  return (
    <svg className="chrome-theme-ic sun" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="chrome-theme-ic moon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalkthroughIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.5 9.5a2.5 2.5 0 114.2 1.8c-.7.7-1.2 1.1-1.2 2.2M12 17h.01"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function WorkspaceChrome({
  scopeClass,
  tagline,
  navItems,
  activeView,
  onNavigate,
  firstName,
  lastName,
  profileRole,
  profileMeta,
  menuActions,
  onStartWalkthrough,
  walkthroughLabel = "Guided walkthrough",
  children,
}) {
  const { theme, toggleTheme } = useTheme();
  const chromeRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onDocClick = (event) => {
      if (chromeRef.current && !chromeRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials = `${(firstName || "U").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
  const displayName = firstName ? `${firstName}${lastName ? ` ${lastName}` : ""}` : "User";

  const go = (view) => {
    onNavigate(view);
    setProfileOpen(false);
  };

  const startWalkthrough = () => {
    onStartWalkthrough?.();
    setProfileOpen(false);
  };

  const isActive = (item) => {
    if (typeof item.isActive === "function") return item.isActive(activeView);
    return activeView === item.id;
  };

  return (
    <div className={`${scopeClass} ma-workspace`} data-theme={theme}>
      <div className="dash-chrome" ref={chromeRef}>
        <nav className="htopnav" aria-label="Dashboard">
          <div className="htopnav-row">
            <button type="button" className="htopnav-logo" onClick={() => go(navItems[0]?.id)}>
              <img src={companyLogo} alt="MarketAtomy" className="htopnav-logo-img" />
              <span className="htopnav-brand">
                <span className="htopnav-name">MarketAtomy</span>
                {tagline ? <span className="htopnav-tag">{tagline}</span> : null}
              </span>
            </button>

            <span className="htopnav-sp" aria-hidden="true" />

            <div className="htopnav-utils">
              <button
                type="button"
                className={`htopnav-theme${theme === "dark" ? " active" : ""}`}
                data-tour="chrome-theme"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                <span className="htopnav-theme-track">
                  <span className="htopnav-theme-knob" />
                  <SunIcon />
                  <MoonIcon />
                </span>
              </button>

              {onStartWalkthrough ? (
                <button
                  type="button"
                  className="htopnav-walkthrough"
                  data-tour="chrome-walkthrough"
                  aria-label={walkthroughLabel}
                  title={walkthroughLabel}
                  onClick={startWalkthrough}
                >
                  <WalkthroughIcon />
                </button>
              ) : null}

              {profileMeta ? <span className="htopnav-meta">{profileMeta}</span> : null}

              <div className="htopnav-profile-wrap">
                <button
                  type="button"
                  className="htopnav-profile"
                  data-tour="chrome-profile"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span className="htopnav-av">{initials}</span>
                  <span className="htopnav-uname">{displayName}</span>
                  <svg className="htopnav-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {profileOpen ? (
                  <div className="htopnav-menu">
                    <div className="htopnav-menu-head">
                      <span className="htopnav-menu-av">{initials}</span>
                      <div>
                        <div className="htopnav-menu-name">{displayName}</div>
                        <div className="htopnav-menu-level">{profileRole}</div>
                      </div>
                    </div>
                    {onStartWalkthrough ? (
                      <button type="button" className="htopnav-menu-item" onClick={startWalkthrough}>
                        {walkthroughLabel}
                      </button>
                    ) : null}
                    {menuActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className={`htopnav-menu-item${action.danger ? " htopnav-menu-signout" : ""}`}
                        onClick={() => {
                          action.onClick();
                          setProfileOpen(false);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </nav>

        <div className="subnav" data-tour="chrome-subnav">
          <div className="subnav-row" role="tablist" aria-label="Workspace sections">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-tour={`nav-${item.id}`}
                aria-selected={isActive(item)}
                className={`stab${isActive(item) ? " on" : ""}`}
                onClick={() => go(item.id)}
              >
                <span>{item.label}</span>
                {item.badge ? <span className="stab-badge">{item.badge}</span> : null}
                {item.count != null ? <span className="stab-count">{item.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="main workspace-main">{children}</main>
    </div>
  );
}

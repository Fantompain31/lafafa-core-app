"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MyStay } from "@/shared/types/database.types";
import { StayAlertsBell } from "./StayAlertsBell";
import "./Sidebar.css";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  enabled?: boolean;
};

const IconHome = () => (
  <svg viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const IconWallet = () => (
  <svg viewBox="0 0 24 24">
    <path d="M20 12V8H6a2 2 0 0 1 0-4h14v4" />
    <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
    <circle cx="16" cy="14" r="1" />
  </svg>
);
const IconBed = () => (
  <svg viewBox="0 0 24 24">
    <path d="M3 7v12" />
    <path d="M21 12v7" />
    <path d="M3 13h18" />
    <path d="M7 13V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v4" />
    <path d="M14 13V9a2 2 0 0 1 2-2h1a4 4 0 0 1 4 4v2" />
  </svg>
);
const IconPhoto = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconMenu = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    stroke="currentColor"
    fill="none"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconX = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    stroke="currentColor"
    fill="none"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    fill="none"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    fill="none"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconDots = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    stroke="currentColor"
    fill="none"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

export function StayLayout({
  stay,
  children,
}: {
  stay: MyStay;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const baseHref = `/stays/${stay.id}`;

  const navItems: NavItem[] = [
    { label: "Accueil", href: baseHref, icon: <IconSun /> },
    { label: "Ma fiche", href: `${baseHref}/me`, icon: <IconUser /> },
    { label: "Membres", href: `${baseHref}/guests`, icon: <IconUsers /> },
    {
      label: "Planning",
      href: `${baseHref}/organisation`,
      icon: <IconCalendar />,
    },
    { label: "Logistique", href: `${baseHref}/logistique`, icon: <IconCart /> },
    { label: "Couchage", href: `${baseHref}/couchage`, icon: <IconBed /> },
    { label: "Budget", href: `${baseHref}/budget`, icon: <IconWallet /> },
    // Module prévu pour plus tard : on garde l'entrée dans la configuration,
    // mais on ne l'affiche pas tant que le module n'est pas développé.
    {
      label: "Souvenirs",
      href: `${baseHref}/souvenirs`,
      icon: <IconPhoto />,
      enabled: false,
    },
    {
      label: "Paramètres",
      href: `${baseHref}/settings`,
      icon: <IconSettings />,
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.enabled !== false);

  const mobileNavItems = [
    { label: "Séjours", href: "/dashboard", icon: <IconHome /> },
    { label: "Accueil", href: baseHref, icon: <IconSun /> },
    { label: "Ma fiche", href: `${baseHref}/me`, icon: <IconUser /> },
    { label: "Membres", href: `${baseHref}/guests`, icon: <IconUsers /> },
    {
      label: "Plus",
      href: "#",
      icon: <IconDots />,
      onClick: () => setDrawerOpen(true),
    },
  ];

  function isActive(href: string) {
    if (href === baseHref) return pathname === baseHref;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const currentPage =
    visibleNavItems.find((i) => isActive(i.href))?.label ?? stay.title;

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <nav className="sidebar-nav">
        <Link href="/dashboard" className="nav-item" onClick={onItemClick}>
          <IconHome />
          <span className="nav-label">Mes séjours</span>
        </Link>
        <div className="nav-section-label">Séjour</div>
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive(item.href) ? "active" : ""}`}
            onClick={onItemClick}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link
          href="/account/profile"
          className="nav-item sidebar-account-link"
          onClick={onItemClick}
          title={collapsed ? "Mon profil" : undefined}
        >
          <IconUser />
          <span className="nav-label">Mon profil</span>
        </Link>

        <button className="signout-btn" onClick={handleSignOut}>
          <IconLogout />
          <span className="signout-label">Déconnexion</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="app-layout">
      {/* Sidebar desktop */}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          {!collapsed && <span className="sidebar-logo">La Fafa</span>}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="app-main">
        {/* Topbar desktop */}
        <div className="app-topbar">
          <div className="app-topbar-main">
            <span className="app-topbar-title">{stay.title}</span>
            <span className="app-topbar-meta">
              {stay.location_name && `${stay.location_name}`}
              {stay.start_date &&
                stay.end_date &&
                ` · ${new Date(stay.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${new Date(stay.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`}
            </span>
          </div>
          <StayAlertsBell stayId={stay.id} />
        </div>

        {/* Header mobile */}
        <div className="mobile-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
          >
            <IconMenu />
          </button>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "#2c2420" }}>
            {stay.title}
          </span>
          <StayAlertsBell stayId={stay.id} />
        </div>

        {/* Contenu */}
        <main className="app-content">{children}</main>

        {/* Nav mobile bas */}
        <nav className="mobile-nav">
          {mobileNavItems.map((item) =>
            item.onClick ? (
              <button
                key="more"
                className={`mobile-nav-item ${drawerOpen ? "active" : ""}`}
                onClick={item.onClick}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item ${isActive(item.href) ? "active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ),
          )}
        </nav>
      </div>

      {/* Drawer mobile */}
      <div className={`mobile-drawer ${drawerOpen ? "open" : ""}`}>
        <div
          className="mobile-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
        />
        <div className="mobile-drawer-panel">
          <div className="sidebar-top">
            <span className="sidebar-logo">La Fafa</span>
            <button
              className="sidebar-toggle"
              onClick={() => setDrawerOpen(false)}
              aria-label="Fermer"
            >
              <IconX />
            </button>
          </div>
          <SidebarContent onItemClick={() => setDrawerOpen(false)} />
        </div>
      </div>
    </div>
  );
}

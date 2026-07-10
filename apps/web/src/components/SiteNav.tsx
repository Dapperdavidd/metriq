// apps/web/src/components/SiteNav.tsx
//
// The persistent app nav. This is what turns Metriq from a single playback screen into
// a product with a front door and rooms you move between. Grid Ferme discipline: paper,
// one ink rule under it, timing colour used only on the active tab.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/arena", label: "ARENA" },
  { href: "/build", label: "BUILD" },
  { href: "/how", label: "HOW IT WORKS" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/" className={styles.brand}>
        <span className={styles.wordmark}>Metriq</span>
        <span className={styles.tag}>METERED SPEND CONTROL</span>
      </Link>
      <div className={styles.links}>
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.link} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

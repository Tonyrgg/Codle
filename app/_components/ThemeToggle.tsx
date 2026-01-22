"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const onMenu = pathname === "/";

  return (
    <div className="floating-actions fixed right-4 top-4 z-50 flex items-center gap-2">
      {!onMenu ? (
        <Link
          href="/"
          className="home-button rounded-full p-2"
          aria-label="Torna al menu principale"
        >
          <svg
            className="home-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10.5V20h14v-9.5" />
          </svg>
        </Link>
      ) : null}

      <button
        type="button"
        aria-label="Toggle dark mode"
        className="theme-toggle rounded-full px-4 py-2 text-sm font-medium"
        onClick={toggleTheme}
      >
        <span className="theme-toggle-thumb">
          {theme === "dark" ? "Modalita' chiara" : "Modalita' scura"}
        </span>
      </button>
    </div>
  );
}

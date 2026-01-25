"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
      <g
        id="SVGRepo_tracerCarrier"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></g>
      <g id="SVGRepo_iconCarrier">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M3.39703 11.6315C3.39703 
          16.602 7.42647 20.6315 12.397 
          20.6315C15.6858 20.6315 18.5656 
          18.8664 20.1358 16.23C16.7285 
          17.3289 12.6922 16.7548 9.98282 
          14.0455C7.25201 11.3146 6.72603 
          7.28415 7.86703 3.89293C5.20697 
          5.47927 3.39703 8.38932 3.39703 
          11.6315ZM21.187 13.5851C22.0125 
          13.1021 23.255 13.6488 23 14.5706C21.7144 
          19.2187 17.4543 22.6315 12.397 22.6315C6.3219 
          22.6315 1.39703 17.7066 1.39703 11.6315C1.39703 
          6.58874 4.93533 2.25845 9.61528 0.999986C10.5393 
          0.751502 11.0645 1.99378 10.5641 2.80935C8.70026 
          5.84656 8.83194 10.0661 11.397 12.6312C13.9319 
          15.1662 18.1365 15.3702 21.187 13.5851Z"
          fill="#000000"
        ></path>
      </g>
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const onMenu = pathname === "/";
  const showBrand = !onMenu;

  return (
    <div className="floating-bar fixed inset-x-0 top-4 z-50 flex items-center justify-between px-4">
      {showBrand ? (
        <span className="game-brand menu-card-title text-2xl font-black uppercase tracking-[0.3em] sm:text-3xl">
          CODLE
        </span>
      ) : (
        <span aria-hidden="true" />
      )}

      <div className="floating-actions flex items-center gap-2">
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
          className="theme-toggle theme-toggle-icon rounded-full text-sm font-medium"
          onClick={toggleTheme}
        >
          <span className="theme-toggle-thumb">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </span>
        </button>
      </div>
    </div>
  );
}

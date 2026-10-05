"use client";

// Cloudflare Turnstile widget. Calls onToken with a one-time token the server checks.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY it renders nothing and passes an empty token.

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("captcha failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function Turnstile({ onToken, onError }: { onToken: (t: string) => void; onError?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      onToken("");
      return;
    }
    let id: string | undefined;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          callback: (t: string) => onToken(t),
          "error-callback": () => onError?.(),
          "expired-callback": () => onToken(""),
        });
      })
      .catch(() => onError?.());
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" />;
}

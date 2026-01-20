"use client";
import { useEffect } from "react";

export function EnsureAnon() {
  useEffect(() => {
    fetch("/api/auth/anon", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}

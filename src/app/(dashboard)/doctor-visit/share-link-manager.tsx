"use client";

import { useState, useEffect } from "react";
import { createShareLink, revokeShareLink } from "./actions";

interface Props {
  activeLink: { token: string; expires_at: string } | null;
}

export function ShareLinkManager({ activeLink }: Props) {
  const [link, setLink] = useState(activeLink);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = link && origin
    ? `${origin}/share/${link.token}`
    : null;

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const token = await createShareLink();
      setLink({
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка создания ссылки");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!confirm("Отозвать ссылку? Врач больше не сможет открыть сводку.")) return;
    setLoading(true);
    setError("");
    try {
      await revokeShareLink();
      setLink(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка отзыва");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-xl card p-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Ссылка для врача</h3>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Создайте временную read-only ссылку, чтобы врач мог видеть вашу сводку без входа в MedHUB.
      </p>

      {error && <p className="mt-2 text-xs" style={{ color: "var(--amber)" }}>{error}</p>}

      {!link && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="mt-3 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium hover:brightness-90 disabled:opacity-50"
          style={{ color: "var(--bg-primary)" }}
        >
          {loading ? "Создание..." : "Создать ссылку"}
        </button>
      )}

      {link && (
        <div className="mt-3">
          <div className="flex items-center gap-2 rounded px-3 py-2" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
            <code className="flex-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {shareUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded px-2.5 py-1 text-xs font-medium hover:brightness-110"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {copied ? "Скопировано!" : "Копировать"}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Действует до {new Date(link.expires_at).toLocaleDateString("ru-RU")}
            </p>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={loading}
              className="text-xs disabled:opacity-50"
              style={{ color: "var(--amber)" }}
            >
              Отозвать ссылку
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

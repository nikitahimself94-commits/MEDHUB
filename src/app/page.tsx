export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: "var(--bg-primary)" }}
    >
      <h1
        className="text-5xl font-bold tracking-[0.2em]"
        style={{ color: "var(--text-primary)" }}
      >
        MEDHUB
      </h1>
      <p
        className="mt-3 text-base"
        style={{ color: "var(--text-muted)" }}
      >
        Умный центр здоровья
      </p>
      <a
        href="/login"
        className="mt-10 rounded-xl px-8 py-3 text-sm font-semibold transition-all hover:shadow-lg active:scale-[0.98]"
        style={{
          backgroundColor: "var(--accent-muted)",
          color: "var(--accent)",
          border: "1.5px solid var(--accent)",
        }}
      >
        Войти
      </a>
    </main>
  );
}

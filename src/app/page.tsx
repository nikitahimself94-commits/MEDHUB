export default function Home() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: "#2D6E6A" }}
    >
      <h1
        className="text-5xl font-bold tracking-[0.2em]"
        style={{ color: "#FFFFFF" }}
      >
        MEDHUB
      </h1>
      <p
        className="mt-3 text-base"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Умный центр здоровья
      </p>
      <a
        href="/login"
        className="mt-10 rounded-xl px-8 py-3 text-sm font-semibold transition-all hover:shadow-lg active:scale-[0.98]"
        style={{
          backgroundColor: "rgba(255,255,255,0.15)",
          color: "#FFFFFF",
          border: "1.5px solid rgba(255,255,255,0.25)",
        }}
      >
        Войти
      </a>
    </main>
  );
}

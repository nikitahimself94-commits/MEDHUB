import { login } from "./actions";
import { DM_Sans, Playfair_Display } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["700"] });

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
});

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden"
      style={{ background: "#2D6E6A" }}
    >
      {/* Background pattern — subtle geometric grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255,255,255,0.02) 0%, transparent 50%),
            linear-gradient(135deg, rgba(255,255,255,0.02) 25%, transparent 25%),
            linear-gradient(225deg, rgba(255,255,255,0.02) 25%, transparent 25%),
            linear-gradient(315deg, rgba(255,255,255,0.02) 25%, transparent 25%),
            linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%)
          `,
          backgroundSize: "100% 100%, 100% 100%, 60px 60px, 60px 60px, 60px 60px, 60px 60px",
        }}
      />

      {/* Soft light overlay from top */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(100,200,185,0.15) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Brand block — large, dominant */}
        <div className="mb-12 text-center">
          {/* Heart mark */}
          <div className="mb-6 inline-flex items-center justify-center">
            <svg width="40" height="37" viewBox="0 0 32 30" fill="none" aria-hidden="true">
              <path
                d="M16 28C16 28 2 20 2 10.5C2 5.8 5.8 2 10.5 2C13.1 2 15.4 3.3 16 4.5C16.6 3.3 18.9 2 21.5 2C26.2 2 30 5.8 30 10.5C30 20 16 28 16 28Z"
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1
            className={`${dmSans.className} text-[3rem] font-bold tracking-[0.22em] leading-none`}
            style={{ color: "#FFFFFF" }}
          >
            MEDHUB
          </h1>
          <p
            className={`${playfair.className} mt-3 text-[17px] tracking-[0.04em]`}
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Умный центр здоровья
          </p>
        </div>

        {/* Login card */}
        <div
          className="rounded-3xl px-10 pb-10 pt-9"
          style={{
            backgroundColor: "rgba(255,255,255,0.97)",
            boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.12)",
          }}
        >
          {searchParams.error && (
            <div
              className="mb-6 rounded-2xl px-4 py-3 text-[13px] font-medium"
              style={{ backgroundColor: "#FDF2F2", color: "#8B4545" }}
            >
              {searchParams.error}
            </div>
          )}

          <form action={login} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[14px] font-semibold"
                style={{ color: "#1E3330" }}
              >
                Логин
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="login-input block w-full rounded-xl px-5 py-4 text-[15px] outline-none transition-all placeholder:font-normal"
                style={{
                  backgroundColor: "#EDF1F0",
                  border: "1.5px solid #C8D5D2",
                  color: "#1A2F2B",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[14px] font-semibold"
                style={{ color: "#1E3330" }}
              >
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Введите пароль"
                className="login-input block w-full rounded-xl px-5 py-4 text-[15px] outline-none transition-all placeholder:font-normal"
                style={{
                  backgroundColor: "#EDF1F0",
                  border: "1.5px solid #C8D5D2",
                  color: "#1A2F2B",
                }}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-xl py-4 text-[15px] font-semibold text-white transition-all hover:shadow-xl active:scale-[0.98]"
                style={{
                  backgroundColor: "#2D6E6A",
                  boxShadow: "0 4px 16px rgba(45,110,106,0.3)",
                }}
              >
                Войти
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-center text-[12px] font-medium"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Ваши данные защищены и доступны только вам
        </p>
      </div>
    </main>
  );
}

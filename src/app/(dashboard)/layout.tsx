import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/login/actions";
import { BottomNav } from "./bottom-nav";
import { TimezoneSetter } from "@/components/timezone-setter";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, patient_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.patient_id) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="text-center">
          <h1
            className="text-2xl font-bold tracking-[0.15em]"
            style={{ color: "var(--text-primary)" }}
          >
            MEDHUB
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Профиль не привязан к пациенту. Обратитесь к администратору.
          </p>
          <form action={logout} className="mt-4">
            <button
              type="submit"
              className="text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <TimezoneSetter />
      <header className="px-4 sm:px-6 pt-2.5 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1
            className="text-sm font-bold tracking-[0.15em]"
            style={{ color: "var(--text-primary)" }}
          >
            MEDHUB
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {profile.display_name || user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs transition-colors"
                style={{ color: "var(--text-muted)", opacity: 0.6 }}
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl lg:max-w-5xl px-4 sm:px-6 py-4 sm:py-6 pb-24">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

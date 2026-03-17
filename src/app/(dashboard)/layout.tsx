import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/login/actions";
import { DashboardNav } from "./dashboard-nav";
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
        style={{ background: "#EFF3F2" }}
      >
        <div className="text-center">
          <h1
            className="text-2xl font-bold tracking-[0.15em]"
            style={{ color: "#1A2F2B" }}
          >
            MEDHUB
          </h1>
          <p className="mt-3 text-sm" style={{ color: "#5A7A74" }}>
            Профиль не привязан к пациенту. Обратитесь к администратору.
          </p>
          <form action={logout} className="mt-4">
            <button
              type="submit"
              className="text-sm font-medium"
              style={{ color: "#2D6E6A" }}
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#C5CECA" }}>
      <TimezoneSetter />
      <header style={{ backgroundColor: "#2D6E6A" }} className="px-6 pt-4 pb-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-[0.15em] text-white">
            MEDHUB
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {profile.display_name || user.email}
              {profile.role && (
                <span
                  className="ml-2 rounded-full px-2.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {profile.role === "patient" ? "Пациент" : "Опекун"}
                </span>
              )}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <DashboardNav />
      <div className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </div>
    </div>
  );
}

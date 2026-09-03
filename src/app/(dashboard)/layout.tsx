import { AppShell } from "@/components/layout/app-shell";
import { getSessionUserId } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  const user = userId
    ? await queryOne<{ email: string; name: string }>(
        "SELECT email, name FROM app_users WHERE id = $1",
        [userId]
      )
    : null;

  return (
    <AppShell
      user={user ? { name: user.name || user.email, email: user.email } : null}
    >
      {children}
    </AppShell>
  );
}

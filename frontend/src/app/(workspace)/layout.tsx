import { AppShell } from "@/widgets/app-shell";
import { Suspense } from "react";
import { Loading } from "@/shared/ui";
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loading label="Открываем кабинет…" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

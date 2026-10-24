"use client";
import { useSession } from "@/entities/session/model/store";
import { CompanyProfile } from "@/widgets/company-profile";
import { PageHeader } from "@/widgets/app-shell";
export function CompanyScreen() {
  const user = useSession((state) => state.user);
  return (
    <>
      <PageHeader
        title="Компания"
        subtitle="Сведения о бизнесе, реквизиты и документы."
      />
      {user && <CompanyProfile user={user} />}
    </>
  );
}

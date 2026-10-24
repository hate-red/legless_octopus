import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ApplicationDetailScreen } from "@/app/_screens/application-detail";
import { Loading } from "@/shared/ui";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  return <ApplicationDetailScreen key={id} id={Number(id)} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Content params={params} />
    </Suspense>
  );
}

// Authenticated screens read their session and data at runtime.
export const instant = false;

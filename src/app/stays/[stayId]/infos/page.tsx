import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StayLayout } from "@/core/stays/components/StayLayout";
import PracticalInfoPageClient from "@/modules/practical-info/PracticalInfoPageClient";
import type { MyStay } from "@/shared/types/database.types";

type Props = { params: { stayId: string } };

export const metadata = { title: "Infos pratiques" };

export default async function PracticalInfosPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: stay, error } = await supabase.from("my_stays").select("*").eq("id", params.stayId).single();
  if (error || !stay) notFound();

  const { data: infos } = await supabase
    .from("stay_practical_infos")
    .select("*")
    .eq("stay_id", params.stayId)
    .order("position", { ascending: true });

  const typedStay = stay as MyStay;

  return (
    <StayLayout stay={typedStay}>
      <PracticalInfoPageClient stayId={params.stayId} myRole={typedStay.my_role} initialInfos={infos ?? []} />
    </StayLayout>
  );
}

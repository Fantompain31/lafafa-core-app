import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StayLayout } from "@/core/stays/components/StayLayout";
import { PersonalChecklistClient } from "@/core/personal-checklists/PersonalChecklistClient";
import type { MyStay } from "@/shared/types/database.types";

type Props = { params: { stayId: string } };
export const metadata = { title: "Ma liste" };
export default async function PersonalListPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: stay, error } = await supabase.from("my_stays").select("*").eq("id", params.stayId).single();
  if (error || !stay) notFound();
  const { data: items } = await supabase.from("stay_personal_checklist_items").select("*").eq("stay_id", params.stayId).order("position", { ascending: true });
  return <StayLayout stay={stay as MyStay}><PersonalChecklistClient stayId={params.stayId} initialItems={items ?? []} /></StayLayout>;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilePersonalListsClient } from "@/core/personal-checklists/ProfilePersonalListsClient";

export const metadata = { title: "Mes listes" };

export default async function AccountListsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: templates } = await supabase
    .from("personal_checklist_templates")
    .select("*")
    .order("created_at", { ascending: true });

  const templateIds = (templates ?? []).map((template) => template.id);
  const { data: items } = templateIds.length
    ? await supabase
        .from("personal_checklist_template_items")
        .select("*")
        .in("template_id", templateIds)
        .order("position", { ascending: true })
    : { data: [] };

  const withItems = (templates ?? []).map((template) => ({
    ...template,
    items: (items ?? []).filter((item) => item.template_id === template.id),
  }));

  return <ProfilePersonalListsClient initialTemplates={withItems} />;
}

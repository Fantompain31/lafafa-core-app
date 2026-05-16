// src/app/stays/[stayId]/organisation/page.tsx

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StayLayout } from '@/core/stays/components/StayLayout';
import OrganisationPageClient from '@/modules/organisation/OrganisationPageClient';
import type { OrganizationEvent } from '@/modules/organisation/organisation.types';
import type { MyStay } from '@/shared/types/database.types';

type Props = { params: { stayId: string } }

export const metadata = { title: 'Organisation' }

export default async function OrganisationPage({ params }: Props) {
  const { stayId } = params;
  const supabase = createClient();

  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Séjour + membership (my_stays filtre déjà par RLS)
  const { data: stay, error: stayError } = await supabase
    .from('my_stays')
    .select('*')
    .eq('id', stayId)
    .single();
  if (stayError || !stay) notFound();

  const typedStay = stay as MyStay;
  const stayStart = typedStay.start_date ?? '';
  const stayEnd   = typedStay.end_date   ?? '';

  // Fetch événements
  const { data: events, error } = await supabase
    .from('organization_events')
    .select('*')
    .eq('stay_id', stayId)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) console.error('[OrganisationPage] fetch events error:', error);

  return (
    <StayLayout stay={typedStay}>
      <OrganisationPageClient
        stayId={stayId}
        stayStart={stayStart}
        stayEnd={stayEnd}
        initialEvents={(events ?? []) as OrganizationEvent[]}
      />
    </StayLayout>
  );
}

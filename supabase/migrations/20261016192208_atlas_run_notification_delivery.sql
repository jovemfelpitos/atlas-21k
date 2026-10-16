-- Opt-in Web Push. Apply after UX-03. No changes to existing application grants or policies.
begin;

create table public.atlas_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 workout_reminders boolean not null default false,
 plan_updates boolean not null default false,
 coach_comments boolean not null default false,
 coach_digest boolean not null default false,
 reminder_time time not null default '07:00' check(extract(second from reminder_time)=0),
 time_zone text not null default 'America/Sao_Paulo' check(length(time_zone) between 1 and 100),
 activated_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.atlas_notification_preferences enable row level security;
revoke all on public.atlas_notification_preferences from public,anon,authenticated;
grant select on public.atlas_notification_preferences to authenticated;
grant insert(user_id,enabled,workout_reminders,plan_updates,coach_comments,coach_digest,reminder_time,time_zone),
 update(user_id,enabled,workout_reminders,plan_updates,coach_comments,coach_digest,reminder_time,time_zone)
 on public.atlas_notification_preferences to authenticated;
create policy notification_preferences_read on public.atlas_notification_preferences for select to authenticated
 using(user_id=(select auth.uid()));
create policy notification_preferences_add on public.atlas_notification_preferences for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy notification_preferences_change on public.atlas_notification_preferences for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function atlas_private.check_notification_preferences() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.time_zone) then
  raise exception 'Fuso horário inválido';
 end if;
 if not exists(select 1 from auth.users where id=new.user_id and email_confirmed_at is not null
  and deleted_at is null and not coalesce(is_anonymous,false)) then raise exception 'Conta indisponível'; end if;
 if TG_OP='UPDATE' then
  if new.user_id<>old.user_id then raise exception 'Conta imutável'; end if;
  new.created_at=old.created_at;
 end if;
 new.updated_at=clock_timestamp();
 if not new.enabled then new.activated_at=null;
 elsif TG_OP='INSERT' then new.activated_at=clock_timestamp();
 elsif not old.enabled or row(new.workout_reminders,new.plan_updates,new.coach_comments,new.coach_digest,new.reminder_time,new.time_zone)
  is distinct from row(old.workout_reminders,old.plan_updates,old.coach_comments,old.coach_digest,old.reminder_time,old.time_zone)
  then new.activated_at=clock_timestamp();
 else new.activated_at=old.activated_at;
 end if;
 return new;
end $$;
revoke all on function atlas_private.check_notification_preferences() from public,anon,authenticated;
create trigger check_notification_preferences before insert or update on public.atlas_notification_preferences
 for each row execute function atlas_private.check_notification_preferences();

-- Endpoints and encryption keys never have a client SELECT path, including for coaches/owners.
create table atlas_private.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint) between 30 and 4096),
 subscription jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index push_subscriptions_user on atlas_private.push_subscriptions(user_id);
alter table atlas_private.push_subscriptions enable row level security;
revoke all on atlas_private.push_subscriptions from public,anon,authenticated,service_role;

create function atlas_private.valid_push_subscription(s jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(s)='object' and length(s->>'endpoint') between 30 and 4096
  and s->>'endpoint' ~ '^https://(fcm[.]googleapis[.]com/(fcm/send|wp)/|updates[.]push[.]services[.]mozilla[.]com/wpush/v[12]/|([a-z0-9-]+[.])*web[.]push[.]apple[.]com/)[A-Za-z0-9_~./?=&%+-]+$'
  and s->'keys'->>'p256dh' ~ '^[A-Za-z0-9_-]{87}=?$'
  and s->'keys'->>'auth' ~ '^[A-Za-z0-9_-]{22}(==)?$'
  and (s->'expirationTime' is null or s->'expirationTime'='null'::jsonb
   or (jsonb_typeof(s->'expirationTime')='number' and (s->>'expirationTime')::numeric>0)),false);
$$;
revoke all on function atlas_private.valid_push_subscription(jsonb) from public,anon,authenticated;

create function atlas_private.save_push_subscription(p_subscription jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account uuid=auth.uid(); clean jsonb; existing uuid;
begin
 if account is null or not exists(select 1 from auth.users where id=account and email_confirmed_at is not null
  and deleted_at is null and not coalesce(is_anonymous,false)) then raise exception 'Entre em uma conta confirmada'; end if;
 if not atlas_private.valid_push_subscription(p_subscription) then raise exception 'Assinatura push inválida'; end if;
 -- Serialize each user's device quota. Only browser-issued keys and allowed endpoints are stored.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account::text,0));
 select id into existing from atlas_private.push_subscriptions where endpoint=p_subscription->>'endpoint' and user_id=account;
 if existing is null and (select count(*) from atlas_private.push_subscriptions where user_id=account)>=10 then
  raise exception 'Limite de 10 aparelhos atingido';
 end if;
 clean=jsonb_build_object('endpoint',p_subscription->>'endpoint','expirationTime',p_subscription->'expirationTime',
  'keys',jsonb_build_object('p256dh',p_subscription->'keys'->>'p256dh','auth',p_subscription->'keys'->>'auth'));
 insert into atlas_private.push_subscriptions(user_id,endpoint,subscription)
 values(account,clean->>'endpoint',clean) on conflict(endpoint) do update
 set created_at=case when atlas_private.push_subscriptions.user_id<>excluded.user_id then clock_timestamp()
  else atlas_private.push_subscriptions.created_at end,
  user_id=excluded.user_id,subscription=excluded.subscription,updated_at=clock_timestamp();
 return jsonb_build_object('saved',true);
end $$;
revoke all on function atlas_private.save_push_subscription(jsonb) from public,anon;
grant execute on function atlas_private.save_push_subscription(jsonb) to authenticated;
create function public.atlas_save_push_subscription(p_subscription jsonb) returns jsonb
language sql security invoker set search_path='' as $$select atlas_private.save_push_subscription(p_subscription)$$;
revoke all on function public.atlas_save_push_subscription(jsonb) from public,anon;
grant execute on function public.atlas_save_push_subscription(jsonb) to authenticated;

create function atlas_private.remove_push_subscription(p_endpoint text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
 delete from atlas_private.push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint;
 return jsonb_build_object('removed',true);
end $$;
revoke all on function atlas_private.remove_push_subscription(text) from public,anon;
grant execute on function atlas_private.remove_push_subscription(text) to authenticated;
create function public.atlas_remove_push_subscription(p_endpoint text) returns jsonb
language sql security invoker set search_path='' as $$select atlas_private.remove_push_subscription(p_endpoint)$$;
revoke all on function public.atlas_remove_push_subscription(text) from public,anon;
grant execute on function public.atlas_remove_push_subscription(text) to authenticated;

create table atlas_private.notification_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('workout_reminder','plan_update','coach_comment','coach_digest')),
 dedupe_key text not null unique,
 plan_id uuid references public.atlas_plans(id) on delete cascade,
 comment_id uuid references public.atlas_session_comments(id) on delete cascade,
 local_date date, window_start timestamptz, window_end timestamptz,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null
);
create index notification_events_pending on atlas_private.notification_events(expires_at,created_at);
create table atlas_private.notification_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references atlas_private.notification_events(id) on delete cascade,
 subscription_id uuid not null references atlas_private.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','leased','sent','cancelled','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default clock_timestamp(),
 lease_token uuid, leased_until timestamptz, sent_at timestamptz, last_status integer,
 unique(event_id,subscription_id)
);
create index notification_deliveries_due on atlas_private.notification_deliveries(next_attempt_at) where status in ('pending','leased');
-- A server timestamp, rather than the editable legacy updated_at, defines digest windows.
-- Existing records are not backfilled. This signal never contains metrics or notes.
create table atlas_private.notification_activity_signals (
 id bigint generated always as identity primary key,
 user_id uuid not null,plan_id uuid not null,session_id text not null,
 touched_at timestamptz not null default clock_timestamp(),
 foreign key(user_id,plan_id,session_id) references public.atlas_activity_records(user_id,plan_id,session_id) on delete cascade
);
create index notification_activity_signals_time on atlas_private.notification_activity_signals(user_id,touched_at);
alter table atlas_private.notification_events enable row level security;
alter table atlas_private.notification_deliveries enable row level security;
alter table atlas_private.notification_activity_signals enable row level security;
revoke all on atlas_private.notification_events,atlas_private.notification_deliveries,atlas_private.notification_activity_signals from public,anon,authenticated,service_role;

create function atlas_private.touch_activity_notification_signal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into atlas_private.notification_activity_signals(user_id,plan_id,session_id)
 values(new.user_id,new.plan_id,new.session_id);
 return new;
end $$;
revoke all on function atlas_private.touch_activity_notification_signal() from public,anon,authenticated,service_role;
create trigger touch_activity_notification_signal after insert or update on public.atlas_activity_records
 for each row execute function atlas_private.touch_activity_notification_signal();

create function atlas_private.enqueue_plan_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.state='published' and (TG_OP='INSERT' or old.state is distinct from 'published') then
  insert into atlas_private.notification_events(user_id,kind,dedupe_key,plan_id,expires_at)
   select new.user_id,'plan_update','plan:'||new.id,new.id,clock_timestamp()+interval '24 hours'
   from public.atlas_notification_preferences p where p.user_id=new.user_id and p.enabled and p.plan_updates
   on conflict(dedupe_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function atlas_private.enqueue_plan_notification() from public,anon,authenticated;
create trigger enqueue_plan_notification after insert or update of state on public.atlas_plans
 for each row execute function atlas_private.enqueue_plan_notification();

create function atlas_private.enqueue_comment_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into atlas_private.notification_events(user_id,kind,dedupe_key,plan_id,comment_id,expires_at)
  select new.user_id,'coach_comment','comment:'||new.id,new.plan_id,new.id,clock_timestamp()+interval '24 hours'
  from public.atlas_notification_preferences p where p.user_id=new.user_id and p.enabled and p.coach_comments
  and new.author_id<>new.user_id on conflict(dedupe_key) do nothing;
 return new;
end $$;
revoke all on function atlas_private.enqueue_comment_notification() from public,anon,authenticated;
create trigger enqueue_comment_notification after insert on public.atlas_session_comments
 for each row execute function atlas_private.enqueue_comment_notification();

-- Re-evaluated on claim AND immediately before transport: disabling preferences, completing
-- a workout, archiving a plan, changing accounts, or revoking a coach stops pending delivery.
create function atlas_private.notification_event_allowed(e atlas_private.notification_events) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.atlas_notification_preferences p join auth.users u on u.id=p.user_id
  where p.user_id=e.user_id and p.enabled and p.activated_at<=e.created_at and e.expires_at>clock_timestamp()
  and u.email_confirmed_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and case e.kind
   when 'plan_update' then p.plan_updates and exists(select 1 from public.atlas_plans q where q.id=e.plan_id and q.user_id=e.user_id and q.state='published')
   when 'workout_reminder' then p.workout_reminders and (clock_timestamp() at time zone p.time_zone)::date=e.local_date
    and exists(select 1 from public.atlas_sessions s join public.atlas_plans q on q.id=s.plan_id
     where q.user_id=e.user_id and q.state='published' and s.plan_id=e.plan_id and s.user_id=e.user_id and s.date=e.local_date
     and not exists(select 1 from public.atlas_activity_records r where r.user_id=s.user_id and r.plan_id=s.plan_id and r.session_id=s.id))
   when 'coach_comment' then p.coach_comments and exists(select 1 from public.atlas_session_comments c
    where c.id=e.comment_id and c.user_id=e.user_id and (exists(select 1 from public.atlas_admins a where a.user_id=c.author_id)
     or exists(select 1 from public.atlas_coaches coach join public.atlas_coach_athletes link on link.coach_id=coach.user_id
      where coach.user_id=c.author_id and coach.active and link.active and link.athlete_id=e.user_id)))
   when 'coach_digest' then p.coach_digest and exists(select 1 from public.atlas_coaches coach
    join public.atlas_coach_athletes link on link.coach_id=coach.user_id
    join atlas_private.notification_activity_signals r on r.user_id=link.athlete_id
    where coach.user_id=e.user_id and coach.active and link.active and r.touched_at>e.window_start and r.touched_at<=e.window_end)
   else false end);
$$;
revoke all on function atlas_private.notification_event_allowed(atlas_private.notification_events) from public,anon,authenticated,service_role;

create function atlas_private.prepare_notifications() returns integer
language plpgsql security definer set search_path='' as $$
declare generated integer; clock_now timestamptz=clock_timestamp();
begin
 -- Never backfill old plans/comments. Timed reminders have a two-hour catch-up window.
 with due as (
  select p.*, (clock_now at time zone p.time_zone)::date local_day,
   (((clock_now at time zone p.time_zone)::date+p.reminder_time) at time zone p.time_zone) due_at
  from public.atlas_notification_preferences p where p.enabled and (p.workout_reminders or p.coach_digest)
 )
 insert into atlas_private.notification_events(user_id,kind,dedupe_key,plan_id,local_date,expires_at)
 select distinct d.user_id,'workout_reminder','workout:'||d.user_id||':'||q.id||':'||d.local_day,q.id,d.local_day,
  least(d.due_at+interval '2 hours',((d.local_day+1)::timestamp at time zone d.time_zone))
 from due d join public.atlas_plans q on q.user_id=d.user_id and q.state='published'
 join public.atlas_sessions s on s.user_id=d.user_id and s.plan_id=q.id and s.date=d.local_day
 where d.workout_reminders and d.activated_at<=d.due_at and d.due_at<=clock_now and clock_now<d.due_at+interval '2 hours'
 and exists(select 1 from atlas_private.push_subscriptions sub where sub.user_id=d.user_id)
 and not exists(select 1 from public.atlas_activity_records r where r.user_id=s.user_id and r.plan_id=s.plan_id and r.session_id=s.id)
 on conflict(dedupe_key) do nothing;
 with due as (
  select p.*, (clock_now at time zone p.time_zone)::date local_day,
   (((clock_now at time zone p.time_zone)::date+p.reminder_time) at time zone p.time_zone) due_at,
   ((((clock_now at time zone p.time_zone)::date-1)+p.reminder_time) at time zone p.time_zone) previous_due_at
  from public.atlas_notification_preferences p where p.enabled and p.coach_digest
 )
 insert into atlas_private.notification_events(user_id,kind,dedupe_key,local_date,window_start,window_end,expires_at)
 select d.user_id,'coach_digest','digest:'||d.user_id||':'||d.local_day,d.local_day,
  greatest(d.activated_at,d.previous_due_at),d.due_at,d.due_at+interval '2 hours'
 from due d where d.activated_at<=d.due_at and d.due_at<=clock_now and clock_now<d.due_at+interval '2 hours'
 and exists(select 1 from atlas_private.push_subscriptions sub where sub.user_id=d.user_id)
 and exists(select 1 from public.atlas_coaches c join public.atlas_coach_athletes l on l.coach_id=c.user_id
  join atlas_private.notification_activity_signals r on r.user_id=l.athlete_id where c.user_id=d.user_id and c.active and l.active
  and r.touched_at>greatest(d.activated_at,d.previous_due_at) and r.touched_at<=d.due_at)
 on conflict(dedupe_key) do nothing;
 -- A newly registered device receives only events created since its registration.
 insert into atlas_private.notification_deliveries(event_id,subscription_id)
 select e.id,s.id from atlas_private.notification_events e join atlas_private.push_subscriptions s on s.user_id=e.user_id
 where e.expires_at>clock_now and s.created_at<=e.created_at and atlas_private.notification_event_allowed(e)
 on conflict(event_id,subscription_id) do nothing;
 get diagnostics generated=row_count;
 update atlas_private.notification_deliveries d set status='cancelled',lease_token=null,leased_until=null
 from atlas_private.notification_events e where d.event_id=e.id and d.status in ('pending','leased')
 and not atlas_private.notification_event_allowed(e);
 update atlas_private.notification_deliveries set status='failed',lease_token=null,leased_until=null
 where status='leased' and attempts>=5 and leased_until<clock_now;
 -- Terminal delivery metadata has a short retention; endpoint revocation cascades immediately.
 delete from atlas_private.notification_events where expires_at<clock_now-interval '7 days';
 delete from atlas_private.notification_activity_signals where touched_at<clock_now-interval '7 days';
 return generated;
end $$;
revoke all on function atlas_private.prepare_notifications() from public,anon,authenticated;
grant usage on schema atlas_private to service_role;
grant execute on function atlas_private.prepare_notifications() to service_role;
create function public.atlas_prepare_notifications() returns integer
language sql security invoker set search_path='' as $$select atlas_private.prepare_notifications()$$;
revoke all on function public.atlas_prepare_notifications() from public,anon,authenticated;
grant execute on function public.atlas_prepare_notifications() to service_role;

create function atlas_private.claim_notifications(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with due as (
  select d.id from atlas_private.notification_deliveries d join atlas_private.notification_events e on e.id=d.event_id
  join atlas_private.push_subscriptions s on s.id=d.subscription_id and s.user_id=e.user_id
  where d.status in ('pending','leased') and d.next_attempt_at<=clock_timestamp() and d.attempts<5
  and (d.leased_until is null or d.leased_until<clock_timestamp()) and atlas_private.notification_event_allowed(e)
  order by d.next_attempt_at,d.id for update of d skip locked limit greatest(1,least(coalesce(p_limit,20),20))
 ), claimed as (
  update atlas_private.notification_deliveries d set status='leased',attempts=d.attempts+1,
   lease_token=gen_random_uuid(),leased_until=clock_timestamp()+interval '5 minutes'
  from due where d.id=due.id returning d.id,d.lease_token
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'lease_token',lease_token)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
revoke all on function atlas_private.claim_notifications(integer) from public,anon,authenticated;
grant execute on function atlas_private.claim_notifications(integer) to service_role;
create function public.atlas_claim_notifications(p_limit integer default 20) returns jsonb
language sql security invoker set search_path='' as $$select atlas_private.claim_notifications(p_limit)$$;
revoke all on function public.atlas_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.atlas_claim_notifications(integer) to service_role;

create function atlas_private.authorize_notification(p_id uuid,p_lease_token uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('id',e.id,'kind',e.kind,'user_id',e.user_id,'subscription',s.subscription)
 from atlas_private.notification_deliveries d join atlas_private.notification_events e on e.id=d.event_id
 join atlas_private.push_subscriptions s on s.id=d.subscription_id and s.user_id=e.user_id
 where d.id=p_id and d.lease_token=p_lease_token and d.status='leased' and d.leased_until>clock_timestamp()
 and atlas_private.notification_event_allowed(e);
$$;
revoke all on function atlas_private.authorize_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function atlas_private.authorize_notification(uuid,uuid) to service_role;
create function public.atlas_authorize_notification(p_id uuid,p_lease_token uuid) returns jsonb
language sql security invoker set search_path='' as $$select atlas_private.authorize_notification(p_id,p_lease_token)$$;
revoke all on function public.atlas_authorize_notification(uuid,uuid) from public,anon,authenticated;
grant execute on function public.atlas_authorize_notification(uuid,uuid) to service_role;

create function atlas_private.finish_notification(p_id uuid,p_lease_token uuid,p_status integer) returns void
language plpgsql security definer set search_path='' as $$
declare delivery atlas_private.notification_deliveries;
begin
 select * into delivery from atlas_private.notification_deliveries where id=p_id and lease_token=p_lease_token
 and status='leased' for update;
 if delivery.id is null then return; end if;
 if p_status in (404,410) then
  delete from atlas_private.push_subscriptions where id=delivery.subscription_id;
 else
  update atlas_private.notification_deliveries set
   status=case when p_status between 200 and 299 then 'sent' when p_status=0 then 'cancelled'
    when attempts>=5 or p_status between 400 and 499 and p_status not in (408,429) then 'failed' else 'pending' end,
   sent_at=case when p_status between 200 and 299 then clock_timestamp() else null end,
   next_attempt_at=clock_timestamp()+make_interval(mins=>least(60,(power(2,delivery.attempts))::integer)),
   last_status=p_status,lease_token=null,leased_until=null where id=p_id;
 end if;
end $$;
revoke all on function atlas_private.finish_notification(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function atlas_private.finish_notification(uuid,uuid,integer) to service_role;
create function public.atlas_finish_notification(p_id uuid,p_lease_token uuid,p_status integer) returns void
language sql security invoker set search_path='' as $$select atlas_private.finish_notification(p_id,p_lease_token,p_status)$$;
revoke all on function public.atlas_finish_notification(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.atlas_finish_notification(uuid,uuid,integer) to service_role;

commit;

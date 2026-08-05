-- PMCC portal — seed: Daher el Souane 563's record + access control.
-- Run AFTER schema.sql: SQL Editor → New query → paste all → Run.

-- ---------------------------------------------------------------- presence
alter table public.profiles add column if not exists last_seen timestamptz;
create policy "own presence" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------- access
-- Who may enter, and as what. Sign-in happens by emailed code; on first
-- sign-in the trigger below turns the auth user into a profile and links
-- their unit. Add future owners by inserting a row here + setting unit_name.
create table if not exists public.pre_approved (
  email text primary key,
  role text not null check (role in ('team', 'owner')),
  full_name text not null,
  unit_name text
);

insert into public.pre_approved (email, role, full_name, unit_name) values
  ('nadim.j.saleh@gmail.com', 'team', 'N. Saleh', null),
  ('info@pmcclb.com', 'owner', 'Rami K. (test)', 'The Roof Residence')
on conflict (email) do nothing;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare pa record;
begin
  select * into pa from pre_approved where email = lower(new.email);
  if found then
    insert into profiles (id, role, full_name, email)
    values (new.id, pa.role, pa.full_name, lower(new.email))
    on conflict (id) do nothing;
    if pa.role = 'owner' and pa.unit_name is not null then
      update units set owner_id = new.id where name = pa.unit_name and owner_id is null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- project
insert into public.projects (id, name, location, delivery, hero_url, overall, phases, milestones) values (
  '11111111-1111-4111-8111-111111111111',
  'Daher el Souane 563',
  'Daher el Souane · Mount Lebanon',
  'Summer 2027',
  '/im/hero-three-quarter-1280.webp',
  46,
  '[{"name":"Permits","pct":100},{"name":"Earthworks","pct":100},{"name":"Structure","pct":82},{"name":"Envelope","pct":12},{"name":"Finishes","pct":0},{"name":"Handover","pct":0}]',
  '[{"name":"Construction permit issued","date":"Jan 2024","done":true},{"name":"Excavation & retaining walls complete","date":"Sep 2024","done":true},{"name":"Basement structure complete","date":"May 2025","done":true},{"name":"Structure top-out","date":"Nov 2026","done":false,"next":true},{"name":"Envelope closed & watertight","date":"Mar 2027","done":false},{"name":"Finishes complete","date":"Jun 2027","done":false},{"name":"Handover","date":"Summer 2027","done":false}]'
);

insert into public.units (id, project_id, name, level, area, extras, plan_url, photo_url, price, member_since) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'The Garden Residence', 'Basement 1', '330 m²', 'Garden 210 m² · four bedrooms', '/im/plan-basement1.webp', '/im/portrait-garden-1280.webp', 500000, ''),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'The Ground Residence', 'Ground Floor', '330 m²', 'Garden 152 m² · four bedrooms', '/im/plan-ground.webp', '/im/entrance-walk-1280.webp', 620000, ''),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111111', 'The First-Floor Residence', 'First Floor', '330 m²', 'Four bedrooms · balconies both fronts', '/im/plan-first.webp', '/im/elevation-front-1280.webp', 680000, ''),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111111', 'The Roof Residence', 'Roof Floor', '300 m²', 'Two terraces · four bedrooms', '/im/plan-roof.webp', '/im/hero-three-quarter-1280.webp', 800000, 'Mar 2026');

-- ---------------------------------------------------------------- content
insert into public.diary (project_id, entry_date, phase, photo_url, body, published) values
  ('11111111-1111-4111-8111-111111111111', '2026-08-01', 'Structure — Level 1', '/im/site-progress-1280.webp', 'Level 1 slab poured Thursday at first light — 74 m³ in one continuous pour, cured under wet burlap through the weekend heat. Formwork strike begins Tuesday.', true),
  ('11111111-1111-4111-8111-111111111111', '2026-07-18', 'Structure — Ground', '/im/entrance-walk-1280.webp', 'Ground-floor columns complete on the garden front. The entrance walk''s retaining geometry is now readable on site.', true),
  ('11111111-1111-4111-8111-111111111111', '2026-07-04', 'Site', '/im/view-ridge-1280.webp', 'Taken from the roof level this morning. The view the terraces will hold — the valley, the ridge across, the sea haze behind Beirut.', true),
  ('11111111-1111-4111-8111-111111111111', '2026-06-20', 'Structure — Basement', '/im/site-finished-1280.webp', 'Basement 2 plant rooms formed: water storage, boiler room and the parking plate. Waterproofing membrane inspected and closed.', true),
  ('11111111-1111-4111-8111-111111111111', '2026-06-06', 'Quality', '/im/elevation-front-1280.webp', 'Concrete cube results for May pours: all above 32 MPa at 28 days, target 30. Third-party lab certificates filed to the project record.', true),
  ('11111111-1111-4111-8111-111111111111', '2026-05-23', 'Programme', '/im/portrait-garden-1280.webp', 'Programme revision P6-R4 accepted: structure top-out holds at November, delivery holds at Summer 2027. Two weeks of float retained on the critical path.', true);

insert into public.lookahead (project_id, weeks) values (
  '11111111-1111-4111-8111-111111111111',
  '[{"label":"This week","range":"Aug 3 – Aug 9","items":[{"t":"Strike Level 1 slab formwork","s":"done"},{"t":"Level 1 column reinforcement","s":"ready"},{"t":"Block D water tank pressure test","s":"ready"},{"t":"Electrical sleeves — Level 1 slab","s":"done"}]},{"label":"Next week","range":"Aug 10 – Aug 16","items":[{"t":"Pour Level 1 columns","s":"ready"},{"t":"Roof-level formwork delivery","s":"ready"},{"t":"Stone sample panel for façade approval","s":"blocked","note":"Supplier ETA Aug 14"}]},{"label":"Week after","range":"Aug 17 – Aug 23","items":[{"t":"Roof slab formwork begins","s":"ready"},{"t":"External drainage — garden side","s":"ready"},{"t":"Site visit day — owners welcome","s":"ready"}]}]'
);

insert into public.risks (project_id, title, body, status, shared_on) values
  ('11111111-1111-4111-8111-111111111111', 'Cement supply interruption', 'National cement plant maintenance paused deliveries for nine days in June. Impact absorbed within programme float — no change to milestones. Closed Jun 28.', 'closed', '2026-06-14'),
  ('11111111-1111-4111-8111-111111111111', 'Façade stone lead time', 'The natural stone supplier quotes 10 weeks from approval against 8 planned. Mitigation: sample panel brought forward to Aug 14; order placed immediately on approval. Envelope milestone unchanged for now.', 'watching', '2026-07-25');

insert into public.payments (unit_id, name, milestone, amount, state, paid_on, ord) values
  ('22222222-2222-4222-8222-222222222204', 'Reservation', 'On signature', 50000, 'paid', '2026-03-12', 1),
  ('22222222-2222-4222-8222-222222222204', 'Contract signature', 'On signature', 120000, 'paid', '2026-04-02', 2),
  ('22222222-2222-4222-8222-222222222204', 'Structure milestone 1', 'Basement complete', 160000, 'paid', '2026-07-08', 3),
  ('22222222-2222-4222-8222-222222222204', 'Structure top-out', 'Milestone — Nov 2026', 160000, 'upcoming', null, 4),
  ('22222222-2222-4222-8222-222222222204', 'Envelope closed', 'Milestone — Mar 2027', 150000, 'upcoming', null, 5),
  ('22222222-2222-4222-8222-222222222204', 'Handover', 'Keys — Summer 2027', 160000, 'upcoming', null, 6);

insert into public.selections (unit_id, title, body, due, state, options, chosen, chosen_name, decided_on) values
  ('22222222-2222-4222-8222-222222222204', 'Master bathroom stone', 'Both options are included in your specification — this is a style choice, not a cost change.', '2026-09-15', 'open',
   '[{"id":"a","name":"Botticino classico — warm ivory","img":"/im/portrait-garden-1280.webp"},{"id":"b","name":"Pietra grey — deep graphite","img":"/im/elevation-rear-1280.webp"}]', null, null, null),
  ('22222222-2222-4222-8222-222222222204', 'Kitchen counter', '', null, 'decided', '[]', 'q', 'Quartz — bone white', '2026-07-02');

insert into public.variations (unit_id, title, body, price, time_impact, state, approved_on) values
  ('22222222-2222-4222-8222-222222222204', 'Terrace outdoor kitchen provision', 'Gas, water and drainage provision plus counter base to the reception terrace, ready for a future outdoor kitchen. Priced per your request of Jul 20.', 9800, 'No programme impact', 'offered', null),
  ('22222222-2222-4222-8222-222222222204', 'Bedrooms 3+4 combined into second master suite', 'Partition omitted, en-suite enlarged, walk-in added. Approved and issued to site — reflected in construction drawings rev. C.', 14500, 'No programme impact', 'approved', '2026-05-30');

insert into public.visits (project_id, unit_id, visit_date, visit_time, state, note) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222204', 'Thu Aug 21, 2026', '10:00', 'booked', 'Hard hat and site boots provided at the gate.'),
  ('11111111-1111-4111-8111-111111111111', null, 'Thu Aug 28, 2026', '10:00', 'offered', ''),
  ('11111111-1111-4111-8111-111111111111', null, 'Sat Aug 30, 2026', '11:30', 'offered', ''),
  ('11111111-1111-4111-8111-111111111111', null, 'Thu Sep 4, 2026', '16:00', 'offered', '');

insert into public.documents (project_id, unit_id, name, meta, url) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222204', 'Sale & purchase contract', 'Signed · Apr 2026 · PDF', null),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222204', 'Roof Residence — floor plan', 'A20/partners · rev C', '/im/plan-roof.webp'),
  ('11111111-1111-4111-8111-111111111111', null, 'Finishes schedule', 'General specification · PDF', null),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222204', 'Payment schedule annex', 'Contract annex 2 · PDF', null),
  ('11111111-1111-4111-8111-111111111111', null, 'Project booklet', 'Dahr el Sawan — Private Residences', null);

insert into public.questions (unit_id, q, a, asked_on, answered_on) values
  ('22222222-2222-4222-8222-222222222204', 'Can the second parking bay be nearer the elevator lobby?', 'Yes — bays B2-04 and B2-05 are both allocated to the Roof Residence; we''ve swapped B2-05 for B2-02, directly opposite the lobby door. Updated parking plan attached to your documents.', '2026-07-26', '2026-07-27');

insert into public.contract_index (unit_id, clauses) values (
  '22222222-2222-4222-8222-222222222204',
  '{"signedOn":"Apr 2, 2026","parties":"Rami K. and PMCC S.A.R.L.","unitClause":"The Roof Residence — full roof floor, 300 m², two terraces, four bedrooms, two covered parking bays (B2-02, B2-04) and one storage room.","paymentClause":"Deposit on reservation, installments tied to certified construction milestones, balance on completion. No installment falls due before its milestone is certified.","deliveryClause":"Delivery in Summer 2027, with a 90-day grace period. Beyond grace, a delay compensation of $2,000 per month applies.","variationClause":"Changes are priced in writing and built only after the owner''s written approval in this portal.","warrantyClause":"Twelve months defects liability from handover; structural warranty per Lebanese decennial liability law."}'
);

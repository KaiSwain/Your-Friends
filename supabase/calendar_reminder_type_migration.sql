-- Add the Reminder calendar item type without rebuilding the table.
alter table public.calendar_events
  drop constraint if exists calendar_events_event_type_check;

alter table public.calendar_events
  add constraint calendar_events_event_type_check
  check (event_type in ('reminder', 'birthday', 'anniversary', 'custom'));

drop policy if exists "Quote owners delete own quotes" on public.quotes;

create policy "Quote owners delete own quotes" on public.quotes
for delete
using (created_by = auth.uid());

notify pgrst, 'reload schema';

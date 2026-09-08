-- Users can remove their own tracking links. Offer deletion itself is performed
-- by the server action after it verifies workspace membership and dependencies.
grant delete on public.utm_links to authenticated;
drop policy if exists member_delete on public.utm_links;
create policy member_delete on public.utm_links for delete to authenticated
using (utm_private.member(workspace_id, true));

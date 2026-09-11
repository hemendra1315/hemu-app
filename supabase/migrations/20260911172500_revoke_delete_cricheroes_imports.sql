-- cricheroes_imports rows are meant to be created once at import time and
-- corrected in place afterward, never deleted directly by a client (they
-- cascade-delete automatically when their match is deleted -- see the
-- comment already in 20260911160000_cricheroes_import_review.sql). That
-- migration granted only select/insert/update to anon/authenticated, but
-- every new table in this project also picks up a DELETE grant from the
-- database's own default privileges unless it's explicitly revoked, so an
-- explicit revoke was applied live at creation time to close that gap. It
-- was never captured in a committed file -- recovered here from the live
-- database's actual grants.

revoke delete on table public.cricheroes_imports from anon;
revoke delete on table public.cricheroes_imports from authenticated;

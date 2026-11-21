-- Workflow Builder inserts Text variables literally: HTML-encoding an ampersand
-- renders visible "&amp;" in team names. Preserve & while retaining the existing
-- angle-bracket protection and whitespace normalization.
create or replace function foos_private.slack_text(p_text text) returns text
language sql immutable set search_path='' as $$
 select replace(replace(regexp_replace(p_text,E'[\n\r\t]+',' ','g'),'<','&lt;'),'>','&gt;');
$$;

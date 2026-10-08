from pathlib import Path
root=Path(__file__).resolve().parent.parent
path=root/'schema-v2.sql'
text=path.read_text(encoding='utf-8')
text=text.replace('exists(select 1 from public.atlas_admins)', 'exists(select 1 from public.atlas_admins where user_id=(select auth.uid()))')
path.write_text(text,encoding='utf-8')

create table if not exists public.images (
  id text primary key,
  author_login text not null,
  author_avatar text not null default '',
  description text not null default '',
  tags jsonb not null default '[]'::jsonb,
  time_mode text not null default 'point',
  start_at timestamptz not null,
  end_at timestamptz,
  captured_at timestamptz not null,
  image_paths jsonb not null default '[]'::jsonb,
  metadata_path text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists images_author_login_idx on public.images (author_login);
create index if not exists images_start_at_idx on public.images (start_at desc);

create table if not exists public.likes (
  post_owner text not null,
  post_id text not null,
  login text not null,
  avatar_url text not null default '',
  liked_at timestamptz not null,
  primary key (post_owner, post_id, login)
);

create index if not exists likes_post_idx on public.likes (post_owner, post_id);

create table if not exists public.comments (
  id text primary key,
  post_owner text not null,
  post_id text not null,
  author_login text not null,
  author_avatar text not null default '',
  text text not null default '',
  image_paths jsonb not null default '[]'::jsonb,
  deleted boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null
);

create index if not exists comments_post_idx on public.comments (post_owner, post_id, created_at asc);
create index if not exists comments_author_idx on public.comments (author_login);

alter table public.comments add column if not exists parent_id text;
alter table public.comments add column if not exists reply_to_user_login text;

create index if not exists comments_post_parent_idx on public.comments (post_owner, post_id, parent_id, created_at asc);
create index if not exists comments_parent_idx on public.comments (parent_id);

create table if not exists public.comment_likes (
  comment_id text not null,
  post_owner text not null,
  post_id text not null,
  login text not null,
  avatar_url text not null default '',
  liked_at timestamptz not null,
  primary key (comment_id, login)
);

create index if not exists comment_likes_post_idx on public.comment_likes (post_owner, post_id);
create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

create index if not exists images_tags_gin_idx on public.images using gin (tags jsonb_path_ops);

create or replace view public.tag_counts as
select
  author_login,
  tag,
  count(*)::int as post_count
from public.images,
  jsonb_array_elements_text(images.tags) as tag
group by author_login, tag;

create or replace function public.get_tag_counts(filter_author text default null)
returns table(tag text, post_count int)
language sql
stable
as $$
  select
    tag,
    count(*)::int as post_count
  from public.images,
    jsonb_array_elements_text(images.tags) as tag
  where filter_author is null or images.author_login = filter_author
  group by tag
  order by post_count desc, tag asc;
$$;

create table if not exists public.follows (
  follower_login text not null,
  following_login text not null,
  created_at timestamptz not null,
  primary key (follower_login, following_login)
);

create index if not exists follows_follower_idx on public.follows (follower_login);
create index if not exists follows_following_idx on public.follows (following_login);

create table if not exists public.users (
  login text primary key,
  provider text not null,
  provider_id text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_provider_idx on public.users (provider);

create or replace view public.user_logins as
select distinct login from public.users where login <> ''
union
select distinct author_login as login from public.images where author_login <> ''
union
select distinct author_login as login from public.comments where author_login <> ''
union
select distinct follower_login as login from public.follows where follower_login <> ''
union
select distinct following_login as login from public.follows where following_login <> '';

create table if not exists public.email_logins (
  token_hash text primary key,
  email text not null,
  login text not null,
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists email_logins_email_idx on public.email_logins (email);
create index if not exists email_logins_expires_idx on public.email_logins (expires_at desc);

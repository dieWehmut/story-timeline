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
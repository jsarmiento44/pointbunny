# Pointy Admin — Server-Side Updates

This is the master reference for all backend changes made in the main Pointy app
that the admin panel needs to know about. Add new entries at the top as features ship.

---

## [2026-05-22] Business Contact Info — Email & Phone

### Migration

```sql
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone text;
```

> No new grants or RLS needed — `businesses` table grants and policies already cover these columns. New columns on existing tables inherit the table's grants.

---

### What changed in the main app

- **Signup**: business name, email (auth email), and phone are now collected at registration and written to `businesses.email` and `businesses.phone`.
- **Settings → Business tab**: Admins can update their business name, contact email, and phone at any time. Saved directly to `businesses` via the service/anon key (RLS: `auth.uid() = id`).
- The `name` column already existed. `email` and `phone` are new.

---

### What the admin panel benefits from

The **Churn Risk** and **Churned** CSV exports previously had empty Email and Phone columns. These now populate automatically — no admin panel code changes needed, the columns just need to exist in the table.

---

## [2026-05-22] Help & Support — Tickets, Replies & Attachments

### New tables

#### `tickets`
```sql
CREATE TABLE public.tickets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category          text        NOT NULL,  -- billing | bug_report | feature_request | account | other
  subject           text        NOT NULL,
  message           text        NOT NULL,
  attachments       text[]      NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'open',  -- open | solved
  has_unread_reply  boolean     NOT NULL DEFAULT false,
  solved_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business insert own tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = business_id);

CREATE POLICY "business read own tickets" ON public.tickets
  FOR SELECT USING (auth.uid() = business_id);

CREATE POLICY "business update own tickets" ON public.tickets
  FOR UPDATE USING (auth.uid() = business_id);
```

#### `ticket_replies`
```sql
CREATE TABLE public.ticket_replies (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid        NOT NULL REFERENCES public.tickets ON DELETE CASCADE,
  sender_type  text        NOT NULL,  -- 'admin' | 'business'
  message      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_replies TO authenticated;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;

-- Businesses can only read replies on their own tickets
CREATE POLICY "business read own replies" ON public.ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.business_id = auth.uid()
    )
  );
```

> Admins use the service role key and bypass RLS — no additional policies needed on the admin side.

---

### Storage bucket: `ticket-attachments`

Create in Supabase dashboard — Storage → New bucket:

- **Name:** `ticket-attachments`
- **Public:** yes (files served via public URL, no signed URLs needed)

Files are stored at path `{businessId}/{timestamp}-{random}.{ext}`.
The `attachments` column on `tickets` holds an array of public image URLs. The main app enforces a max of 1 image per ticket.

**Required storage RLS policy** (without this, uploads fail with an RLS error):
```sql
CREATE POLICY "authenticated users can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### How the business-side works (important for admin UX)

| Behaviour | Detail |
|---|---|
| Ticket creation | Business fills out category, subject, message, optional image. One ticket per submission. |
| Unread badge | A red badge appears on the Help & Support card on the home page when `has_unread_reply = true` on any ticket. Cleared when the business opens that ticket. |
| Solved tickets | Business can mark a ticket solved. They are warned it **cannot be reopened** — they must create a new ticket if the issue returns. |
| 7-day auto-hide | Solved tickets disappear from the business view 7 days after `solved_at`. Rows stay in the DB — admin panel should show all tickets regardless of age. |
| Categories | `billing`, `bug_report`, `feature_request`, `account`, `other` |

---

### What the admin panel needs to implement

#### Viewing tickets
Query `tickets` with `ticket_replies` joined or fetched separately. Order by `created_at DESC`.
Show a badge or indicator when `has_unread_reply = true` — this means the business hasn't seen your latest reply yet.

#### Reading a ticket thread
Fetch the original message from `tickets.message` (this is the first message in the thread),
then fetch all rows from `ticket_replies` for that ticket ordered by `created_at ASC`.
Render them as a conversation: `sender_type = 'business'` on the right, `sender_type = 'admin'` on the left.

#### Sending a reply
Use the **service role key**. Insert the reply, then flip `has_unread_reply` so the business sees the notification badge:

```js
await supabase.from('ticket_replies').insert({
  ticket_id: ticketId,
  sender_type: 'admin',
  message: replyText,
})

await supabase
  .from('tickets')
  .update({ has_unread_reply: true })
  .eq('id', ticketId)
```

When the business opens the ticket in their app, the app automatically sets `has_unread_reply = false`.

#### Marking a ticket solved (admin-side)
```js
await supabase
  .from('tickets')
  .update({ status: 'solved', solved_at: new Date().toISOString() })
  .eq('id', ticketId)
```

#### Displaying attachments
`ticket.attachments` is a `text[]` of public image URLs. Render each as `<img src={url} />`.
Max 1 image per ticket in the current implementation.

---

_Add new sections above this line as more features ship._

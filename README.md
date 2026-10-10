# Freelance Tracker

A tracker for freelancers: clients, orders, payments, daily check-ins, and a "Needs attention" list.

## Run it

    npm install
    npm run dev

## What's in v1

- Clients with contact, source, and a "log contact" button
- Orders with status, service, price, currency, start and due dates
- Payments in any currency, with the exchange rate on the day, and expected vs received
- Daily check-in with hours, clients contacted, and blockers
- "Needs attention": overdue, due soon, delivered but unpaid, no due date, no price, quiet clients
- Global search (Ctrl+K) and a quick add menu
- Settings for your own currencies, services, platforms, and payment methods
- CSV export of all data

## Accounts and data

- Sign up and sign in with email and password (Supabase Auth).
- Data is stored in Supabase Postgres. Every table has row-level security, so each
  user can only read and change their own rows. Anonymous requests are refused.
- `src/supabase.ts` holds the project URL and the publishable key. Both are public by
  design. Never put the secret or service_role key in this app.
- You can override them with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Before other people can sign up

- Supabase's built-in email sender only delivers to your own Supabase team, about
  2 emails an hour. Set up a custom SMTP provider (Authentication > Emails > SMTP).
- Set the Site URL and redirect URLs to the live address
  (Authentication > URL Configuration), so confirmation and reset links open the app.

## Preview build

`VITE_PREVIEW=1 npm run build` makes a browser-only version with example data and no
sign-in, for demos.

## Stack

TypeScript, React, Vite, Supabase.

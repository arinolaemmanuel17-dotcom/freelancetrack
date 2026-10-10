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

## Where the data is

For now, data is saved in this browser (localStorage). Export a CSV backup from Settings regularly.
Login and a hosted database are the next step.

## Stack

TypeScript, React, Vite.

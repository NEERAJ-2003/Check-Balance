# Check Balance (Mobile Only)

A simple **HTML + CSS + JavaScript** mobile-only balance tracker with **Login/Signup first** and **localStorage** persistence.

## Features

- **Signup + Login (mandatory)**: the app opens to auth first.
- **Per-user storage**: each user has their own initial balance + transactions (saved in `localStorage`).
- **Fix initial balance** anytime in **Settings**.
- **Add amount** (credit) and **Debit amount** (manual).
- **Delete transaction** asks a confirmation: “Are you sure you want to delete…?”
- **Slow animations** and a consistent blue/purple theme.
- **Strictly mobile-only**: desktop screens are blocked with an overlay.
- **Zoom disabled** (viewport + gesture prevention).

## How to run

### Option A (recommended): Live Server

1. Open this folder in VS Code / Cursor.
2. Install and run **Live Server** on `index.html`.

### Option B: Open directly

Double-click `index.html` to open it in your mobile browser.

## Files

- `index.html` – UI (auth + app)
- `styles.css` – mobile UI + animations + desktop-block
- `app.js` – localStorage, auth, transactions, balance math, confirmation modal


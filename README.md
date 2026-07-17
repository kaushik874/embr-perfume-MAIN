# Embr Perfume — E-commerce

Luxury perfume storefront with auth, SQLite database, and Razorpay payments (INR).

## Features

- **Theme** — Forest-night hero + warm parchment shop (design tokens in `src/index.css`)
- **Auth** — Register / login with JWT (httpOnly cookie)
- **Database** — SQLite (`data/embr.db`) with users, products, orders
- **Payments** — Razorpay (UPI, cards) or **demo mode** without API keys

## Quick start

```bash
cd embr-perfume-source
cp .env.example .env
npm install
npm run dev
```

- Storefront: http://localhost:5173  
- API: http://localhost:3001  

## Razorpay (live payments)

1. Create account at https://dashboard.razorpay.com  
2. Copy **Test** Key ID & Secret into `.env`:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
JWT_SECRET=your-long-random-secret
```

3. Restart `npm run dev` and checkout — Razorpay modal opens.

Without keys, checkout completes in **demo mode** (order saved as paid).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend + API together |
| `npm run build` | Production build |
| `npm start` | Serve API + static build (set `NODE_ENV=production`) |

## Project layout

```
server/          Express API, SQLite, Razorpay
src/             React + Vite storefront
data/            SQLite file (created on first run)
public/images/   Bottle SVG placeholders
```

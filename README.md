# VERTEX Shopping Website

VERTEX is a working shopping website with customer registration, login, product catalog, search, category filters, cart, checkout, order history, contact form, and owner/admin dashboard.

## Run on your Apple Mac

1. Open Terminal.
2. Go to this folder:

```bash
cd /Users/akshat/Documents/Codex/2026-07-08/create-a-strong-working-website-which/outputs/vertex-shopping-app
```

3. Start the website:

```bash
npm start
```

4. Open this URL in any browser on the same Mac:

```text
http://localhost:3000
```

## Owner Login

```text
Email: admin@vertex.local
Password: admin123
```

After login, click the diamond button in the top bar to open the owner dashboard. You can see registered users, their details, orders, addresses, payment method, contact messages, and revenue stats.

## Customer Flow

- Register first.
- Login.
- Browse products.
- Add items to cart.
- Place an order.
- Open orders to see your order history.

## Data Storage

The app creates this file automatically when it first runs:

```text
data/db.json
```

That file stores registered users, hashed passwords, sessions, carts, orders, and contact messages.

## Use From Any System Over The Internet

To access it from any computer by internet, deploy the folder to a Node.js hosting service such as Render, Railway, Fly.io, or a VPS.

Basic deployment settings:

```text
Build command: none
Start command: npm start
Port: use the PORT environment variable from the hosting provider
```

For a real public business site, replace the JSON file database with a hosted database such as PostgreSQL or MongoDB, add HTTPS, change the admin password, and connect a real payment gateway.

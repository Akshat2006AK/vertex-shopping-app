const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_FILE = path.join(ROOT, "data", "db.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const productImages = [
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512499617640-c2f999098c01?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80"
];

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (fs.existsSync(DB_FILE)) return;

  const adminPassword = hashPassword("admin123");
  const db = {
    users: [
      {
        id: "usr_admin",
        name: "VERTEX Owner",
        email: "admin@vertex.local",
        phone: "0000000000",
        passwordHash: adminPassword.hash,
        salt: adminPassword.salt,
        role: "admin",
        address: "Owner dashboard",
        createdAt: now()
      }
    ],
    products: seedProducts(),
    carts: {},
    orders: [],
    messages: [],
    sessions: {}
  };
  writeDb(db);
}

function seedProducts() {
  const products = [
    ["Vertex Nova Watch", "Electronics", 12999, 22, 4.8, "AMOLED display, health tracking, seven-day battery, metal case."],
    ["AeroRun Pro Shoes", "Fashion", 4999, 18, 4.6, "Responsive foam, breathable mesh, day-long comfort."],
    ["PulseBand X", "Electronics", 3499, 30, 4.4, "Fitness band with sleep, steps, heart rate, and phone alerts."],
    ["SonicPods Max", "Electronics", 6999, 16, 4.7, "Active noise cancellation, clear calls, immersive sound."],
    ["Vertex Studio Headphones", "Electronics", 8999, 11, 4.8, "Comfort-fit over-ear headphones tuned for music and work."],
    ["Urban Shield Sunglasses", "Fashion", 1799, 42, 4.3, "Polarized UV400 lenses with lightweight acetate frame."],
    ["TravelCore Backpack", "Lifestyle", 2599, 26, 4.5, "Laptop sleeve, weather-resistant shell, smart compartments."],
    ["StrideFlex Sneakers", "Fashion", 3999, 20, 4.4, "Minimal everyday sneakers with grippy sole and soft lining."]
  ];

  return products.map((item, index) => ({
    id: `prd_${index + 1}`,
    name: item[0],
    category: item[1],
    price: item[2],
    stock: item[3],
    rating: item[4],
    description: item[5],
    image: productImages[index],
    createdAt: now()
  }));
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const attempt = hashPassword(password, user.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function getToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function getAuthedUser(req, db) {
  const token = getToken(req);
  const session = db.sessions[token];
  if (!session || Date.now() > session.expiresAt) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function requireAuth(req, res, db) {
  const user = getAuthedUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: "Please login first." });
    return null;
  }
  return user;
}

function requireAdmin(req, res, db) {
  const user = requireAuth(req, res, db);
  if (!user) return null;
  if (user.role !== "admin") {
    sendJson(res, 403, { error: "Admin access required." });
    return null;
  }
  return user;
}

function validateRequired(body, fields) {
  for (const field of fields) {
    if (!String(body[field] || "").trim()) return `${field} is required.`;
  }
  return "";
}

function cartSummary(db, userId) {
  const cart = db.carts[userId] || {};
  const items = Object.entries(cart).map(([productId, quantity]) => {
    const product = db.products.find((entry) => entry.id === productId);
    return product ? { product, quantity } : null;
  }).filter(Boolean);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = subtotal > 0 && subtotal < 999 ? 99 : 0;
  const total = subtotal + shipping;
  return { items, subtotal, shipping, total };
}

async function handleApi(req, res, pathname) {
  const db = readDb();
  const body = req.method === "GET" ? {} : await parseBody(req);

  if (req.method === "POST" && pathname === "/api/register") {
    const missing = validateRequired(body, ["name", "email", "phone", "password"]);
    if (missing) return sendJson(res, 400, { error: missing });
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "Enter a valid email." });
    if (String(body.password).length < 6) return sendJson(res, 400, { error: "Password must be at least 6 characters." });
    if (db.users.some((user) => user.email === email)) return sendJson(res, 409, { error: "Email is already registered." });

    const password = hashPassword(String(body.password));
    const user = {
      id: id("usr"),
      name: String(body.name).trim(),
      email,
      phone: String(body.phone).trim(),
      passwordHash: password.hash,
      salt: password.salt,
      role: "customer",
      address: String(body.address || "").trim(),
      createdAt: now()
    };
    db.users.push(user);
    writeDb(db);
    return sendJson(res, 201, { user: safeUser(user), message: "Registration successful. Please login." });
  }

  if (req.method === "POST" && pathname === "/api/login") {
    const missing = validateRequired(body, ["email", "password"]);
    if (missing) return sendJson(res, 400, { error: missing });
    const user = db.users.find((entry) => entry.email === String(body.email).trim().toLowerCase());
    if (!user || !verifyPassword(String(body.password), user)) return sendJson(res, 401, { error: "Invalid email or password." });
    const token = id("ses");
    db.sessions[token] = { userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
    writeDb(db);
    return sendJson(res, 200, { token, user: safeUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const token = getToken(req);
    if (token) delete db.sessions[token];
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const user = getAuthedUser(req, db);
    return sendJson(res, 200, { user: safeUser(user) });
  }

  if (req.method === "GET" && pathname === "/api/products") {
    return sendJson(res, 200, { products: db.products });
  }

  if (req.method === "GET" && pathname === "/api/cart") {
    const user = requireAuth(req, res, db);
    if (!user) return;
    return sendJson(res, 200, cartSummary(db, user.id));
  }

  if (req.method === "POST" && pathname === "/api/cart") {
    const user = requireAuth(req, res, db);
    if (!user) return;
    const product = db.products.find((entry) => entry.id === body.productId);
    if (!product) return sendJson(res, 404, { error: "Product not found." });
    const quantity = Math.max(1, Math.min(99, Number(body.quantity || 1)));
    db.carts[user.id] = db.carts[user.id] || {};
    db.carts[user.id][product.id] = Math.min(product.stock, (db.carts[user.id][product.id] || 0) + quantity);
    writeDb(db);
    return sendJson(res, 200, cartSummary(db, user.id));
  }

  if (req.method === "PATCH" && pathname === "/api/cart") {
    const user = requireAuth(req, res, db);
    if (!user) return;
    db.carts[user.id] = db.carts[user.id] || {};
    const quantity = Number(body.quantity || 0);
    if (quantity <= 0) delete db.carts[user.id][body.productId];
    else db.carts[user.id][body.productId] = Math.min(99, quantity);
    writeDb(db);
    return sendJson(res, 200, cartSummary(db, user.id));
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const user = requireAuth(req, res, db);
    if (!user) return;
    const summary = cartSummary(db, user.id);
    if (!summary.items.length) return sendJson(res, 400, { error: "Your cart is empty." });
    const missing = validateRequired(body, ["address", "paymentMethod"]);
    if (missing) return sendJson(res, 400, { error: missing });
    const order = {
      id: id("ord"),
      userId: user.id,
      customer: safeUser(user),
      items: summary.items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      address: String(body.address).trim(),
      paymentMethod: String(body.paymentMethod).trim(),
      note: String(body.note || "").trim(),
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      total: summary.total,
      status: "Placed",
      createdAt: now()
    };
    db.orders.unshift(order);
    db.carts[user.id] = {};
    writeDb(db);
    return sendJson(res, 201, { order });
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    const user = requireAuth(req, res, db);
    if (!user) return;
    const orders = user.role === "admin" ? db.orders : db.orders.filter((order) => order.userId === user.id);
    return sendJson(res, 200, { orders });
  }

  if (req.method === "POST" && pathname === "/api/messages") {
    const user = getAuthedUser(req, db);
    const missing = validateRequired(body, ["name", "email", "message"]);
    if (missing) return sendJson(res, 400, { error: missing });
    const message = {
      id: id("msg"),
      userId: user ? user.id : null,
      name: String(body.name).trim(),
      email: String(body.email).trim().toLowerCase(),
      phone: String(body.phone || "").trim(),
      message: String(body.message).trim(),
      createdAt: now()
    };
    db.messages.unshift(message);
    writeDb(db);
    return sendJson(res, 201, { message, ok: true });
  }

  if (req.method === "GET" && pathname === "/api/admin") {
    const admin = requireAdmin(req, res, db);
    if (!admin) return;
    return sendJson(res, 200, {
      stats: {
        users: db.users.length,
        customers: db.users.filter((user) => user.role === "customer").length,
        orders: db.orders.length,
        revenue: db.orders.reduce((sum, order) => sum + order.total, 0),
        messages: db.messages.length
      },
      users: db.users.map(safeUser),
      orders: db.orders,
      messages: db.messages,
      carts: db.carts
    });
  }

  sendJson(res, 404, { error: "API route not found." });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

ensureDb();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname).catch((error) => {
      sendJson(res, 500, { error: error.message || "Server error." });
    });
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`VERTEX is running at http://localhost:${PORT}`);
  console.log("Admin login: admin@vertex.local / admin123");
});

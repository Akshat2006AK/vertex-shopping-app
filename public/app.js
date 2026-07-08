const state = {
  token: localStorage.getItem("vertexToken") || "",
  user: null,
  products: [],
  category: "All",
  search: ""
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const els = {
  productGrid: document.querySelector("#productGrid"),
  searchInput: document.querySelector("#searchInput"),
  cartButton: document.querySelector("#cartButton"),
  cartCount: document.querySelector("#cartCount"),
  cartDrawer: document.querySelector("#cartDrawer"),
  closeCart: document.querySelector("#closeCart"),
  cartItems: document.querySelector("#cartItems"),
  authDialog: document.querySelector("#authDialog"),
  accountButton: document.querySelector("#accountButton"),
  loginForm: document.querySelector("#loginForm"),
  registerForm: document.querySelector("#registerForm"),
  checkoutForm: document.querySelector("#checkoutForm"),
  contactForm: document.querySelector("#contactForm"),
  toast: document.querySelector("#toast"),
  ordersView: document.querySelector("#ordersView"),
  homeView: document.querySelector("#homeView"),
  adminView: document.querySelector("#adminView"),
  ordersList: document.querySelector("#ordersList"),
  adminStats: document.querySelector("#adminStats"),
  adminUsers: document.querySelector("#adminUsers"),
  adminOrders: document.querySelector("#adminOrders"),
  adminMessages: document.querySelector("#adminMessages")
};

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  });
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function requireLogin() {
  if (state.user) return true;
  els.authDialog.showModal();
  toast("Please register or login first.");
  return false;
}

function renderAccount() {
  els.accountButton.textContent = state.user ? state.user.name.split(" ")[0] : "Login";
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", state.user?.role !== "admin");
  });
}

function renderProducts() {
  const query = state.search.toLowerCase();
  const products = state.products.filter((product) => {
    const categoryMatch = state.category === "All" || product.category === state.category;
    const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return categoryMatch && text.includes(query);
  });

  els.productGrid.innerHTML = products.map((product) => `
    <article class="product-card">
      <img src="${product.image}" alt="${escapeHtml(product.name)}">
      <div class="product-body">
        <div class="product-meta">
          <span>${escapeHtml(product.category)}</span>
          <span>★ ${product.rating}</span>
        </div>
        <h3 class="product-title">${escapeHtml(product.name)}</h3>
        <p class="muted">${escapeHtml(product.description)}</p>
        <span class="price">${money.format(product.price)}</span>
        <span class="muted">${product.stock} in stock</span>
      </div>
      <div class="product-actions">
        <button class="primary-link" data-add="${product.id}">Add to cart</button>
      </div>
    </article>
  `).join("") || `<p class="muted">No matching products found.</p>`;
}

async function loadProducts() {
  const data = await api("/api/products");
  state.products = data.products;
  renderProducts();
}

async function refreshCart() {
  if (!state.user) {
    els.cartCount.textContent = "0";
    els.cartItems.innerHTML = `<p class="muted">Login to use your cart.</p>`;
    return;
  }
  const cart = await api("/api/cart");
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  els.cartCount.textContent = String(count);
  els.cartItems.innerHTML = cart.items.map((item) => `
    <div class="line-item">
      <img src="${item.product.image}" alt="${escapeHtml(item.product.name)}">
      <div>
        <strong>${escapeHtml(item.product.name)}</strong>
        <div class="muted">${money.format(item.product.price)} each</div>
        <div class="qty-row">
          <button data-qty="${item.product.id}" data-next="${item.quantity - 1}" aria-label="Decrease">−</button>
          <span>${item.quantity}</span>
          <button data-qty="${item.product.id}" data-next="${item.quantity + 1}" aria-label="Increase">+</button>
          <button data-qty="${item.product.id}" data-next="0">Remove</button>
        </div>
      </div>
    </div>
  `).join("");

  if (!cart.items.length) {
    els.cartItems.innerHTML = `<p class="muted">Your cart is empty.</p>`;
  } else {
    els.cartItems.innerHTML += `
      <div class="data-row">
        <div>Subtotal: <strong>${money.format(cart.subtotal)}</strong></div>
        <div>Shipping: <strong>${money.format(cart.shipping)}</strong></div>
        <div>Total: <strong>${money.format(cart.total)}</strong></div>
      </div>
    `;
  }
}

async function addToCart(productId) {
  if (!requireLogin()) return;
  await api("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 })
  });
  await refreshCart();
  toast("Added to cart.");
}

async function updateQuantity(productId, quantity) {
  await api("/api/cart", {
    method: "PATCH",
    body: JSON.stringify({ productId, quantity })
  });
  await refreshCart();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function login(payload) {
  const data = await api("/api/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("vertexToken", state.token);
  renderAccount();
  await refreshCart();
  els.authDialog.close();
  toast(`Welcome, ${state.user.name}.`);
}

async function hydrateSession() {
  if (!state.token) return;
  try {
    const data = await api("/api/me");
    state.user = data.user;
    if (!state.user) localStorage.removeItem("vertexToken");
  } catch {
    localStorage.removeItem("vertexToken");
    state.token = "";
  }
  renderAccount();
  await refreshCart();
}

function showView(view) {
  document.querySelectorAll(".nav .icon-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.homeView.classList.toggle("hidden", view !== "home");
  document.querySelector(".catalog-section").classList.toggle("hidden", view !== "home");
  els.ordersView.classList.toggle("hidden", view !== "orders");
  els.adminView.classList.toggle("hidden", view !== "admin");
  if (view === "orders") loadOrders();
  if (view === "admin") loadAdmin();
}

async function loadOrders() {
  if (!requireLogin()) {
    showView("home");
    return;
  }
  const data = await api("/api/orders");
  els.ordersList.innerHTML = data.orders.map((order) => `
    <div class="data-row">
      <strong>${order.id}</strong>
      <div class="muted">${new Date(order.createdAt).toLocaleString()} · ${escapeHtml(order.status)}</div>
      <div>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join(", ")}</div>
      <div><strong>${money.format(order.total)}</strong> · ${escapeHtml(order.paymentMethod)}</div>
      <div class="muted">${escapeHtml(order.address)}</div>
    </div>
  `).join("") || `<p class="muted">No orders yet.</p>`;
}

async function loadAdmin() {
  if (!state.user || state.user.role !== "admin") {
    toast("Admin login required.");
    showView("home");
    return;
  }
  const data = await api("/api/admin");
  els.adminStats.innerHTML = Object.entries(data.stats).map(([label, value]) => `
    <div class="stat">
      <span class="muted">${label}</span>
      <strong>${label === "revenue" ? money.format(value) : value}</strong>
    </div>
  `).join("");
  els.adminUsers.innerHTML = data.users.map((user) => `
    <div class="data-row">
      <strong>${escapeHtml(user.name)}</strong>
      <div>${escapeHtml(user.email)} · ${escapeHtml(user.phone)}</div>
      <div class="muted">${escapeHtml(user.address || "No address")} · ${escapeHtml(user.role)}</div>
    </div>
  `).join("");
  els.adminOrders.innerHTML = data.orders.map((order) => `
    <div class="data-row">
      <strong>${escapeHtml(order.customer.name)} · ${money.format(order.total)}</strong>
      <div>${order.items.map((item) => `${escapeHtml(item.name)} × ${item.quantity}`).join(", ")}</div>
      <div class="muted">${escapeHtml(order.address)} · ${new Date(order.createdAt).toLocaleString()}</div>
    </div>
  `).join("") || `<p class="muted">No orders yet.</p>`;
  els.adminMessages.innerHTML = data.messages.map((message) => `
    <div class="data-row">
      <strong>${escapeHtml(message.name)}</strong>
      <div>${escapeHtml(message.email)} · ${escapeHtml(message.phone)}</div>
      <div class="muted">${escapeHtml(message.message)}</div>
    </div>
  `).join("") || `<p class="muted">No messages yet.</p>`;
}

document.addEventListener("click", async (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) addToCart(addButton.dataset.add);

  const qtyButton = event.target.closest("[data-qty]");
  if (qtyButton) updateQuantity(qtyButton.dataset.qty, Number(qtyButton.dataset.next));

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) showView(viewButton.dataset.view);
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    state.category = button.dataset.category;
    document.querySelectorAll(".filter").forEach((entry) => entry.classList.toggle("active", entry === button));
    renderProducts();
  });
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderProducts();
});

els.cartButton.addEventListener("click", async () => {
  if (!requireLogin()) return;
  await refreshCart();
  els.cartDrawer.classList.add("open");
  els.cartDrawer.setAttribute("aria-hidden", "false");
});

els.closeCart.addEventListener("click", () => {
  els.cartDrawer.classList.remove("open");
  els.cartDrawer.setAttribute("aria-hidden", "true");
});

els.accountButton.addEventListener("click", async () => {
  if (!state.user) {
    els.authDialog.showModal();
    return;
  }
  await api("/api/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  state.token = "";
  localStorage.removeItem("vertexToken");
  renderAccount();
  await refreshCart();
  showView("home");
  toast("Logged out.");
});

document.querySelector("#openRegister").addEventListener("click", () => els.authDialog.showModal());
document.querySelector("#refreshAdmin").addEventListener("click", loadAdmin);

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await login(formData(els.loginForm));
    els.loginForm.reset();
  } catch (error) {
    toast(error.message);
  }
});

els.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify(formData(els.registerForm))
    });
    toast("Registration successful. Login now.");
    els.registerForm.reset();
  } catch (error) {
    toast(error.message);
  }
});

els.checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  try {
    await api("/api/orders", {
      method: "POST",
      body: JSON.stringify(formData(els.checkoutForm))
    });
    els.checkoutForm.reset();
    await refreshCart();
    els.cartDrawer.classList.remove("open");
    toast("Order placed successfully.");
    showView("orders");
  } catch (error) {
    toast(error.message);
  }
});

els.contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/messages", {
      method: "POST",
      body: JSON.stringify(formData(els.contactForm))
    });
    els.contactForm.reset();
    toast("Message sent.");
  } catch (error) {
    toast(error.message);
  }
});

loadProducts()
  .then(hydrateSession)
  .then(refreshCart)
  .catch((error) => toast(error.message));

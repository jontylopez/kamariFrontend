import { getCartItems } from './pos_state.js';
const orderApi = "http://localhost:3000/api/pos-order";

export async function updateOrderNumber() {
  try {
    const res = await axios.get(`${orderApi}/next-id`);
    const nextId = res.data.nextId;
    const padded = String(nextId).padStart(3, "0");

    document.getElementById("orderNumber").textContent = padded;
  } catch (err) {
    console.error("Error fetching next order number:", err);
    document.getElementById("orderNumber").textContent = "???";
  }
}
// === Add Item to Cart ===
export function addToCart(item) {
  const cartItems = getCartItems(); // ✅ call function

  const existing = cartItems.find(
    (ci) => ci.id === item.id && ci.stockMovementId === item.stockMovementId
  );

  if (existing) {
    existing.quantity += 1;
    existing.total = existing.quantity * existing.price;
  } else {
    cartItems.push({ ...item });
  }

  renderCart();
}
//Update Total after Addidng A Total Discount
document.getElementById("billDiscount")?.addEventListener("input", () => {
  renderCart();
});

// === Render Cart UI ===
export function renderCart() {
  const cartItems = getCartItems(); // ✅ call function
  const container = document.getElementById("cartList");
  const totalEl = document.getElementById("totalAmount");
  const countEl = document.getElementById("cartItemCount");

  if (!container || !totalEl || !countEl) return;

  container.innerHTML = "";
  let subtotal = 0;
  let itemCount = 0;

  cartItems.forEach((item, index) => {
    const itemTotal = getItemTotal(item);
    subtotal += itemTotal;
    itemCount += item.quantity;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.setAttribute("data-index", index);
    row.innerHTML = `
      <div class="cart-details">
        <strong>${item.name || "Unnamed"}</strong>
        <small>Size: ${item.size || "-"}</small>
        <small>Color: ${item.color || "-"}</small>
      </div>

      <div class="cart-actions">
        <label>Qty:</label>
        <input
          type="number"
          value="${item.quantity || 1}"
          min="1"
          onchange="window.updateQuantity(${index}, this.value)"
        />

        <label>Disc:</label>
        <input
          type="number"
          value="${item.discount || 0}"
          min="0"
          max="100"
          onchange="window.updateDiscount(${index}, this.value)"
        />%

        <div class="item-total">
          Rs ${itemTotal.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
        </div>
        <button onclick="window.removeItem(${index})">🗑</button>
      </div>
    `;
    container.appendChild(row);
  });

  const billDiscountInput = document.getElementById("billDiscount");
  const billDiscount = parseFloat(billDiscountInput?.value || 0);
  const total = subtotal * (1 - billDiscount / 100);

  totalEl.textContent = total.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
  });
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 0);
  countEl.textContent = itemCount;
}
export function highlightCartItem(index) {
  const itemRow = document.querySelector(`.cart-item[data-index="${index}"]`);
  if (itemRow) {
    itemRow.classList.add("highlight-cart");
    setTimeout(() => {
      itemRow.classList.remove("highlight-cart");
    }, 500); // 0.5 seconds
  }
}


// === Update Qty / Discount ===
export function updateQuantity(index, value) {
  const cartItems = getCartItems(); // ✅ call function
  const qty = parseInt(value) || 1;
  cartItems[index].quantity = qty;
  renderCart();
}

export function updateDiscount(index, value) {
  const cartItems = getCartItems(); // ✅ call function
  const discount = parseFloat(value) || 0;
  cartItems[index].discount = discount;
  renderCart();
}

// === Helpers ===
export function getItemTotal(item) {
  const base = item.quantity * item.price;
  const discount = (item.discount || 0) / 100;
  return base * (1 - discount);
}

export function getCartTotal() {
    const cartItems = getCartItems(); // ✅ call function
    const billDiscount = parseFloat(document.getElementById("billDiscount")?.value || 0);
    const subtotal = cartItems.reduce((sum, item) => sum + getItemTotal(item), 0);
    let total = subtotal * (1 - billDiscount / 100);  
    return total;
  }

// === Remove / Clear Cart ===
export function removeItem(index) {
  const cartItems = getCartItems(); // ✅ call function
  const item = cartItems[index];
  const confirmDelete = confirm(`Remove "${item.name}" from the cart?`);
  if (!confirmDelete) return;

  cartItems.splice(index, 1);
  renderCart();
}

export function clearCart() {
  const cartItems = getCartItems(); // ✅ call function
  if (cartItems.length === 0) {
    return alert("🛒 Cart is already empty.");
  }

  const confirmed = confirm("Are you sure you want to clear all items from the cart?");
  if (!confirmed) return;

  cartItems.length = 0; // ✅ clear array in-place
  renderCart();
  document.getElementById("totalAmount").textContent = "0.00";

  const billDiscountField = document.getElementById("billDiscount");
  if (billDiscountField) {
    billDiscountField.value = "0";
  }
}

// === Expose inline handlers globally ===
window.updateQuantity = updateQuantity;
window.updateDiscount = updateDiscount;
window.removeItem = removeItem;
window.renderCart = renderCart;

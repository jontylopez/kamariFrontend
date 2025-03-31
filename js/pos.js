// === API Endpoints ===
const sessionApi = "http://localhost:3000/api/pos-session";
const orderApi = "http://localhost:3000/api/pos-order";
const orderItemApi = "http://localhost:3000/api/pos-order-item";
const paymentApi = "http://localhost:3000/api/pos-payment";
const inventoryApi = "http://localhost:3000/api/inventory";
const customerApi = "http://localhost:3000/api/customer";
const productApi = "http://localhost:3000/api/products";
const stockApi = "http://localhost:3000/api/stock-movements";

// === Global Variables ===
let sessionActive = false;
let currentSessionId = null;
let cartItems = [];
let selectedCustomerId = null;

// === DOM Ready ===
document.addEventListener("DOMContentLoaded", async () => {
  await checkActiveSession();
  await updateOrderNumber();

  document
    .getElementById("startDayBtn")
    .addEventListener("click", startNewSession);
  document
    .getElementById("closeDayBtn")
    .addEventListener("click", closeCurrentSession);
  document
    .getElementById("barcodeInput")
    .addEventListener("keypress", handleBarcodeScan);
  document
    .getElementById("checkoutBtn")
    .addEventListener("click", handleCheckout);
  document
    .getElementById("searchCustomerBtn")
    .addEventListener("click", searchCustomer);
  document
    .getElementById("registerCustomerBtn")
    .addEventListener("click", registerCustomer);
  document
    .getElementById("validateCashBtn")
    .addEventListener("click", finalizeCashPaymentAndPrint);
  document.getElementById("clearCartBtn").addEventListener("click", clearCart);

  // Handle Skip (guest customer)
  document.getElementById("skipCustomerBtn").addEventListener("click", () => {
    selectedCustomerId = null;
    showPaymentMethods();
  });

  // Card success button inside modal
  const cardSuccessBtn = document.getElementById("cardSuccessBtn");
  if (cardSuccessBtn) {
    cardSuccessBtn.addEventListener("click", finalizeCardPaymentAndPrint);
  }

  document.getElementById("cashInAmount").addEventListener("input", () => {
    const cashIn =
      parseFloat(document.getElementById("cashInAmount").value) || 0;
    const total = getCartTotal();
    const balance = (cashIn - total).toFixed(2);
    document.getElementById("liveBalance").textContent =
      balance >= 0 ? balance : "0.00";
  });
});

// === Session ===
async function checkActiveSession() {
  try {
    const res = await axios.get(`${sessionApi}/active`);
    const session = res.data;

    sessionActive = session.status === "open";
    currentSessionId = session.id;

    document.getElementById("startDayBtn").disabled = true;
    document.getElementById("closeDayBtn").disabled = !sessionActive;
    document.getElementById("sessionStatus").textContent = sessionActive
      ? `✅ Session Open | Cash: Rs. ${parseFloat(session.startup_cash).toFixed(
          2
        )}`
      : "❌ Session Closed";

    togglePOSAccess(sessionActive);
  } catch {
    togglePOSAccess(false);
  }
}

function togglePOSAccess(enabled) {
  document.querySelectorAll("input, button").forEach((el) => {
    if (!el.classList.contains("always-enabled") && !el.closest("header")) {
      el.disabled = !enabled;
    }
  });
}

async function startNewSession() {
  const amount = parseFloat(prompt("Enter opening cash:") || 0);
  const now = new Date();
  const session_date = now.toISOString().split("T")[0];
  const start_time = now.toTimeString().split(" ")[0];

  const res = await axios.post(sessionApi, {
    startup_cash: amount,
    session_date,
    start_time,
    status: "open",
  });

  currentSessionId = res.data.id;
  await checkActiveSession();
}

async function closeCurrentSession() {
  if (!confirm("Are you sure you want to close the current session?")) return;

  try {
    // 🔄 Fetch current session details
    const res = await axios.get(`${sessionApi}/${currentSessionId}`);
    const currentSession = res.data;

    const now = new Date();
    const endTime = now.toTimeString().split(" ")[0]; // HH:MM:SS

    // 🟢 Send full required data
    await axios.put(`${sessionApi}/${currentSessionId}`, {
      session_date: currentSession.session_date,
      start_time: currentSession.start_time,
      startup_cash: currentSession.startup_cash,
      status: "closed",
      end_time: endTime,
      cash_in_drawer: 0, // Or actual cash in drawer if tracked
      closed_by: "admin", // Change if you're using dynamic user
    });

    sessionActive = false;
    currentSessionId = null;

    document.getElementById("startDayBtn").disabled = false;
    document.getElementById("closeDayBtn").disabled = true;
    document.getElementById("sessionStatus").textContent =
      "❌ No Active Session";
    document.getElementById("sessionStatus").style.color = "#f44336";
  } catch (error) {
    console.error("Error closing session:", error);
    alert("Failed to close session");
  }
}

async function updateOrderNumber() {
  try {
    const res = await axios.get(orderApi);
    const orders = res.data;

    // Get the latest ID and increment
    const latestId = orders.length > 0 ? orders[0].id : 0;
    const nextId = latestId + 1;
    const padded = String(nextId).padStart(3, "0");

    document.getElementById("orderNumber").textContent = padded;
  } catch (err) {
    console.error("Error fetching order number:", err);
    document.getElementById("orderNumber").textContent = "???";
  }
}

// === Barcode Scanning ===
async function handleBarcodeScan(e) {
  if (e.key !== "Enter") return;

  const code = e.target.value.trim();
  if (!code) return;
  e.target.value = "";

  try {
    // Get inventory data using barcode
    const inv = (await axios.get(`${inventoryApi}/barcode/${code}`)).data;

    // Get product name (optional for display, inv.name is enough)
    const product = (await axios.get(`${productApi}/${inv.productId}`)).data;

    // Fetch stock movements and filter relevant ones
    const allStocks = (await axios.get(stockApi)).data;
    const validStocks = allStocks.filter(
      (s) => s.inventoryId === inv.id && s.quantity > 0
    );

    if (validStocks.length === 0) {
      alert("❌ Out of stock.");
      return;
    }

    const baseItemData = {
      id: inv.id,
      name: inv.name || product.name,
      size: inv.size || "-",
      color: inv.color || "-",
      quantity: 1,
      discount: 0,
    };

    if (validStocks.length === 1) {
      // Only one stock movement — auto select
      const selected = validStocks[0];
      const item = {
        ...baseItemData,
        price: parseFloat(selected.sell_price),
        total: parseFloat(selected.sell_price),
        stockMovementId: selected.id,
      };
      addToCart(item);
    } else {
      // Multiple price entries → show modal
      showPriceSelectionModal(inv.name, validStocks, (selected) => {
        const item = {
          ...baseItemData,
          price: parseFloat(selected.sell_price),
          total: parseFloat(selected.sell_price),
          stockMovementId: selected.id,
        };
        addToCart(item);
      });
    }
  } catch (err) {
    console.error("❌ Barcode error:", err);
    alert("Item not found.");
  }
}

function showPriceSelectionModal(productName, stockOptions, callback) {
  document.getElementById(
    "priceModalProductName"
  ).textContent = `Available prices for ${productName}`;
  const container = document.getElementById("priceOptions");
  container.innerHTML = "";

  stockOptions.forEach((stock) => {
    const btn = document.createElement("button");
    btn.textContent = `Rs ${parseFloat(stock.sell_price).toFixed(2)} (Qty: ${
      stock.quantity
    })`;
    btn.onclick = () => {
      document.getElementById("priceSelectModal").style.display = "none";
      callback(stock);
    };
    container.appendChild(btn);
  });

  document.getElementById("priceSelectModal").style.display = "flex";
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

// === Cart Functions ===
function addToCart(item) {
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

function renderCart() {
  const container = document.getElementById("cartList");
  const totalEl = document.getElementById("totalAmount");
  container.innerHTML = "";
  let subtotal = 0;

  cartItems.forEach((item, index) => {
    const itemTotal = getItemTotal(item);
    subtotal += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-details">
        <strong>${item.name}</strong>
        <small>Size: ${item.size || "-"}</small>
        <small>Color: ${item.color || "-"}</small>
      </div>

      <div class="cart-actions">
        <label>Qty:</label>
        <input type="number" value="${
          item.quantity
        }" min="1" onchange="updateQuantity(${index}, this.value)" />

        <label>Disc:</label>
        <input type="number" value="${
          item.discount || 0
        }" min="0" max="100" onchange="updateDiscount(${index}, this.value)" />%

        <div class="item-total">Rs ${itemTotal.toFixed(2)}</div>
        <button onclick="removeItem(${index})">🗑</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Apply bill-wide discount
  const billDiscount = parseFloat(
    document.getElementById("billDiscount")?.value || 0
  );
  const total = subtotal * (1 - billDiscount / 100);

  totalEl.textContent = total.toFixed(2);
}

function updateQuantity(index, value) {
  const qty = parseInt(value) || 1;
  cartItems[index].quantity = qty;
  renderCart();
}

function updateDiscount(index, value) {
  const discount = parseFloat(value) || 0;
  cartItems[index].discount = discount;
  renderCart();
}

function getItemTotal(item) {
  const base = item.quantity * item.price;
  const discount = (item.discount || 0) / 100;
  return base * (1 - discount);
}

function getCartTotal() {
  const billDiscount = parseFloat(
    document.getElementById("billDiscountInput")?.value || 0
  );
  const subtotal = cartItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  return subtotal * (1 - billDiscount / 100);
}

function removeItem(index) {
  const item = cartItems[index];
  const confirmDelete = confirm(`Remove "${item.name}" from the cart?`);
  if (!confirmDelete) return;

  cartItems.splice(index, 1);
  renderCart();
}

function clearCart() {
  if (cartItems.length === 0) {
    return alert("🛒 Cart is already empty.");
  }

  const confirmed = confirm(
    "Are you sure you want to clear all items from the cart?"
  );
  if (!confirmed) return;

  cartItems = [];
  renderCart();
  document.getElementById("totalAmount").textContent = "0.00";

  // Reset bill discount too (if applicable)
  const billDiscountField = document.getElementById("billDiscount");
  if (billDiscountField) {
    billDiscountField.value = "0";
  }
}

// === Proceed to Payment ===
function handleCheckout() {
  if (cartItems.length === 0) return alert("Empty cart");
  document.getElementById("customerModal").style.display = "flex";
}

async function searchCustomer() {
  const phone = document.getElementById("customerPhone").value.trim();
  if (!phone) return;
  try {
    const res = await axios.get(`${customerApi}/phone/${phone}`);
    selectedCustomerId = res.data.id;
    showPaymentMethods();
  } catch {
    document.getElementById("newCustomerFields").style.display = "block";
  }
}

async function registerCustomer() {
  const name = document.getElementById("customerName").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();

  if (!name || !email) return;

  try {
    const res = await axios.post(customerApi, { name, email, phone });
    selectedCustomerId = res.data.id;
    showPaymentMethods(); // ✅ Correct function here now
  } catch (err) {
    console.error("Customer registration error:", err);
    alert("❌ Failed to register customer.");
  }
}
function showPaymentMethods() {
  closeModal("customerModal");
  document.getElementById("paymentModal").style.display = "flex";
}

function handlePaymentMethod(method) {
  closeModal("paymentModal");

  const total = getCartTotal().toFixed(2);

  switch (method) {
    case "cash":
      document.getElementById("cashDueTotal").textContent = total;
      document.getElementById("cashModal").style.display = "flex";
      break;

    case "card":
      document.getElementById("cardDueTotal").textContent = total;
      document.getElementById("cardModal").style.display = "flex";
      break;

    case "qr":
      document.getElementById("qrModal").style.display = "flex";
      break;

    case "voucher":
      document.getElementById("voucherModal").style.display = "flex";
      break;

    default:
      alert("Unknown payment method.");
  }
}

function showCashModal() {
  closeModal("customerModal");
  closeModal("paymentModal");

  const cashTotalEl = document.getElementById("cashDueTotal");
  if (!cashTotalEl) return alert("❌ Missing cashDueTotal element!");

  cashTotalEl.textContent = getCartTotal().toFixed(2);
  document.getElementById("cashModal").style.display = "flex";
}

// === Default Final Validation Function ===
async function finalizePayment(method, cashInAmount = 0) {
  try {
    const now = new Date();
    const total = getCartTotal();

    // 1. Create Order
    const orderRes = await axios.post(orderApi, {
      session_id: currentSessionId,
      order_date: now.toISOString().split("T")[0],
      order_time: now.toTimeString().split(" ")[0],
      customer_id: selectedCustomerId,
      total: total,
    });

    const orderId = orderRes.data.id;

    // 2. Add Items to pos_order_item
    for (const item of cartItems) {
      const subtotal =
        item.quantity * item.price * (1 - (item.discount || 0) / 100);

      await axios.post(orderItemApi, {
        order_id: orderId,
        inventory_id: item.id,
        stock_movement_id: item.stockMovementId || null,
        price: item.price,
        quantity: item.quantity,
        subtotal: subtotal,
      });

      // 3. Update Stock Movement Quantity
      if (item.stockMovementId) {
        const stock = await axios.get(`${stockApi}/${item.stockMovementId}`);
        const updatedQty = stock.data.quantity - item.quantity;

        await axios.put(`${stockApi}/update-quantity/${item.stockMovementId}`, {
          quantity: updatedQty < 0 ? 0 : updatedQty,
        });
      }
    }

    // 4. Record Payment (save total only, not cashIn)
    await axios.post(paymentApi, {
      order_id: orderId,
      method: method,
      amount: total, // Always store the total, not what was received
    });


   // 5. Render both receipt and shop copy together
   renderReceiptAndShopCopy(orderId, selectedCustomerId, method, cashInAmount);

   // 6. Reset cart and UI
   cartItems = [];
   renderCart();
   updateOrderNumber(); // Load next order number
   document.getElementById("totalAmount").textContent = "0.00";
   document.getElementById("cashInAmount").value = "";
   document.getElementById("liveBalance").textContent = "0.00";
   
    closeModal("cashModal");
    closeModal("cardModal");
  } catch (err) {
    console.error("❌ Finalization failed:", err);
    alert("Error completing transaction.");
  }
}


function finalizeCashPaymentAndPrint() {
  const cashIn = parseFloat(document.getElementById("cashInAmount").value);
  const total = getCartTotal();

  if (isNaN(cashIn) || cashIn < total) {
    alert("❌ Insufficient cash received.");
    return;
  }

  // Set and display balance
  const balance = (cashIn - total).toFixed(2);
  document.getElementById("liveBalance").textContent = balance;

  // Proceed with finalization
  finalizePayment("cash", cashIn);
}

function finalizeCardPaymentAndPrint() {
  // No cash amount needed
  finalizePayment("card");
}

function renderReceiptAndShopCopy(orderId, customerId, paymentMethod, cashInAmount = null) {
  // Get current date and time
  const date = new Date();
  const orderNo = String(orderId).padStart(5, "0");
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const total = getCartTotal();
  const customerName = customerId ? `#${customerId}` : "Guest";

  // Fill customer receipt placeholders
  document.getElementById("receiptOrderNumber").textContent = orderNo;
  document.getElementById("receiptCustomerId").textContent = customerName;
  document.getElementById("receiptDate").textContent = dateStr;
  document.getElementById("receiptTime").textContent = timeStr;
  document.getElementById("receiptPaymentMethod").textContent = paymentMethod.toUpperCase();
  document.getElementById("receiptTotal").textContent = total.toFixed(2);

  // Fill cart items for customer receipt
  const tbody = document.getElementById("receiptItemRows");
  tbody.innerHTML = "";

  cartItems.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>Rs ${item.price.toFixed(2)}</td>
      <td>Rs ${getItemTotal(item).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Fill shop copy details
  document.getElementById("shopCopyOrderId").textContent = orderNo;
  document.getElementById("shopCopyCustomer").textContent = customerName;
  document.getElementById("shopCopyMethod").textContent = paymentMethod.toUpperCase();
  document.getElementById("shopCopyTotal").textContent = total.toFixed(2);

  // Handle cash payment specific details
  if (paymentMethod === "cash" && cashInAmount !== null) {
    document.getElementById("shopCopyCashInWrap").style.display = "block";
    document.getElementById("shopCopyCashIn").textContent = cashInAmount.toFixed(2);
  } else {
    document.getElementById("shopCopyCashInWrap").style.display = "none";
  }

  // Display the modal with both receipts
  document.getElementById("receiptModal").style.display = "flex";
}


function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

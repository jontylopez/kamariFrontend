// === API Endpoints ===
const sessionApi = "http://localhost:3000/api/pos-session";
const orderApi = "http://localhost:3000/api/pos-order";
const orderItemApi = "http://localhost:3000/api/pos-order-item";
const paymentApi = "http://localhost:3000/api/pos-payment";
const inventoryApi = "http://localhost:3000/api/inventory";
const customerApi = "http://localhost:3000/api/customer";
const productApi = "http://localhost:3000/api/products";
const stockApi = "http://localhost:3000/api/stock-movements";
const cashApi = "http://localhost:3000/api/cash";

// === Global Variables ===
let sessionActive = false;
let currentSessionId = null;
let cartItems = [];
let selectedCustomerId = null;
let cashTrType = null;

// === DOM Ready ===
document.addEventListener("DOMContentLoaded", async () => {
  await updateSessionCashStatus();
  await updateOrderNumber();
  startLiveClock();
  setInterval(updateSessionCashStatus, 30000);
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
  document.getElementById("cashInBtn").addEventListener("click", () => {
    openCashModal("in");
  });

  document.getElementById("cashOutBtn").addEventListener("click", () => {
    openCashModal("out");
  });

  document
    .getElementById("submitCashTrBtn")
    .addEventListener("click", submitCashTransaction);
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

    if (session.active) {
      sessionActive = true;
      currentSessionId = session.id;
    } else {
      sessionActive = false;
      currentSessionId = null;
    }
  } catch (err) {
    console.error("❌ Error checking session:", err);
    sessionActive = false;
    currentSessionId = null;
  }

  document.getElementById("startDayBtn").disabled = sessionActive;
  document.getElementById("closeDayBtn").disabled = !sessionActive;
  togglePOSAccess(sessionActive);
}


// async function checkActiveSession() {
//   try {
//     const res = await axios.get(`${sessionApi}/active`);
//     const session = res.data;

//     if (session && session.status === "open") {
//       sessionActive = true;
//       currentSessionId = session.id;
//     } else {
//       sessionActive = false;
//       currentSessionId = null;
//     }

//     // Control session buttons
//     document.getElementById("startDayBtn").disabled = sessionActive;
//     document.getElementById("closeDayBtn").disabled = !sessionActive;

//     togglePOSAccess(sessionActive);
//   } catch (err) {
//     console.error("❌ Error checking session:", err);
//     sessionActive = false;
//     currentSessionId = null;
//     togglePOSAccess(false);
//   }
// }
async function updateSessionCashStatus() {
  try {
    // ✅ Ensure session is up to date first
    await checkActiveSession();

    if (!sessionActive || !currentSessionId) {
      document.getElementById("sessionStatus").textContent =
        "❌ No Active Session";
      return;
    }

    // 1. Get current session details
    const res = await axios.get(`${sessionApi}/active`);
    const session = res.data;

    // 2. Get all cash transactions for this session
    const cashTrRes = await axios.get(`${cashApi}/session/${session.id}`);
    const cashTransactions = cashTrRes.data;

    // 3. Get all payments for this session
    const paymentRes = await axios.get(`${paymentApi}`);
    const sessionPayments = paymentRes.data.filter(
      (p) => p.method === "cash" && p.order && p.order.session_id === session.id
    );

    // 4. Calculate totals
    const cashIn = cashTransactions
      .filter((t) => t.type === "in")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const cashOut = cashTransactions
      .filter((t) => t.type === "out")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const cashPayments = sessionPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    const cashInDrawer = cashIn + cashPayments - cashOut;
    const sessionDate = new Date(session.session_date).toLocaleDateString();

    // 5. Update UI
    document.getElementById("sessionStatus").innerHTML = `
      ✅ Session Open | <strong>Date:</strong> ${sessionDate} |
      <strong>Cash:</strong> Rs. ${cashInDrawer.toFixed(2)} |
      <strong>Time:</strong> <span id="liveClock">--:--:--</span>
    `;
  } catch (err) {
    console.error("Failed to update session cash status", err);
  }
}

function startLiveClock() {
  setInterval(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const clockEl = document.getElementById("liveClock");
    if (clockEl) clockEl.textContent = timeString;
  }, 1000);
}

function togglePOSAccess(enabled) {
  document.querySelectorAll("input, button").forEach((el) => {
    if (!el.classList.contains("always-enabled") && !el.closest("header")) {
      el.disabled = !enabled;
    }
  });
  // Explicitly disable/enable cash buttons too
  document.getElementById("cashInBtn").disabled = !enabled;
  document.getElementById("cashOutBtn").disabled = !enabled;
}

async function recordCashTransaction({
  session_id,
  order_id = null,
  type,
  reason,
  amount,
  date,
  time,
  recorded_by = "POS Operator",
}) {
  try {
    await axios.post(cashApi, {
      session_id,
      order_id,
      type,
      reason,
      amount,
      date,
      time,
      recorded_by,
    });
    await updateSessionCashStatus();
  } catch (err) {
    console.error("❌ Error logging cash transaction:", err);
  }
}

async function startNewSession() {
  const input = prompt("Enter opening cash:");
  if (input === null) return; // Cancel pressed
  const amount = parseFloat(input);

  if (isNaN(amount) || amount < 0) {
    alert("❌ Invalid opening cash amount.");
    return;
  }

  const now = new Date();
  const session_date = now.toISOString().split("T")[0];
  const start_time = now.toTimeString().split(" ")[0];

  // 1. Create POS session
  const res = await axios.post(sessionApi, {
    startup_cash: amount,
    session_date,
    start_time,
    status: "open",
  });

  currentSessionId = res.data.id;

  // 2. Record as cash_transaction
  await recordCashTransaction({
    session_id: currentSessionId,
    type: "in",
    reason: "Day Start Cash",
    amount: amount,
    date: session_date,
    time: start_time,
  });

  await updateSessionCashStatus();
}

async function submitCashTransaction() {
  const amount = parseFloat(document.getElementById("cashTrAmount").value);
  const reason = document.getElementById("cashTrReason").value.trim();

  if (isNaN(amount) || amount <= 0) {
    return alert("❌ Please enter a valid amount.");
  }

  if (!reason) {
    return alert("❌ Please enter a reason.");
  }

  // 🔍 DEBUG
  if (!currentSessionId) {
    console.error("❌ No active session ID available");
    return alert("No active session found. Cannot record cash transaction.");
  }

  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0];

  await recordCashTransaction({
    session_id: currentSessionId,
    type: cashTrType, // from openCashModal()
    reason,
    amount,
    date,
    time,
    recorded_by: "POS Operator",
  });

  closeModal("cashTrModal");
  alert(`✅ Cash ${cashTrType === "in" ? "added" : "withdrawn"} successfully.`);
}

async function closeCurrentSession() {
  if (!confirm("Are you sure you want to close the current session?")) return;

  try {
    generateCSV();
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

function openCashModal(type) {
  if (!currentSessionId) {
    alert("❌ Start a session before recording cash.");
    return;
  }

  cashTrType = type;
  document.getElementById("cashTrTitle").textContent =
    type === "in" ? "Cash In" : "Cash Out";
  document.getElementById("cashTrAmount").value = "";
  document.getElementById("cashTrReason").value = "";
  document.getElementById("cashTrModal").style.display = "flex";
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

  if (!name || !phone) {
    return alert("❌ Name and phone number are required.");
  }

  try {
    // Only send email if it's not empty
    const payload = {
      name,
      phone,
      ...(email && { email }) // spread email only if provided
    };

    const res = await axios.post(customerApi, payload);
    selectedCustomerId = res.data.id;
    showPaymentMethods();
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
    const billDiscount = parseFloat(
      document.getElementById("billDiscount")?.value || 0
    );
    // 1. Create Order
    const orderRes = await axios.post(orderApi, {
      session_id: currentSessionId,
      order_date: now.toISOString().split("T")[0],
      order_time: now.toTimeString().split(" ")[0],
      customer_id: selectedCustomerId,
      discount: billDiscount,
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
        discount: item.discount || 0,
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
    // 5. Record Cash Transaction (Only if method is cash)
    if (method === "cash") {
      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const time = now.toTimeString().split(" ")[0];

      await recordCashTransaction({
        session_id: currentSessionId,
        order_id: orderId,
        type: "in",
        reason: "Cash Payment",
        amount: total,
        date,
        time,
        recorded_by: "POS Operator",
      });
    }

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

function renderReceiptAndShopCopy(
  orderId,
  customerId,
  paymentMethod,
  cashInAmount = null
) {
  const date = new Date();
  const orderNo = String(orderId).padStart(5, "0");
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const total = getCartTotal();
  const customerName = customerId ? `#${customerId}` : "Guest";

  // Bill-wide discount
  const billDiscount = parseFloat(
    document.getElementById("billDiscount")?.value || 0
  );

  // Set top-level placeholders
  document.getElementById("receiptOrderNumber").textContent = orderNo;
  document.getElementById("receiptCustomerId").textContent = customerName;
  document.getElementById("receiptDate").textContent = dateStr;
  document.getElementById("receiptTime").textContent = timeStr;
  document.getElementById("receiptPaymentMethod").textContent =
    paymentMethod.toUpperCase();
  document.getElementById("receiptTotal").textContent = total.toFixed(2);

  // 👇 Show bill-wide discount if any
  if (billDiscount > 0) {
    document.getElementById("receiptBillDiscountWrap").style.display = "block";
    document.getElementById("receiptBillDiscount").textContent = billDiscount;
  } else {
    document.getElementById("receiptBillDiscountWrap").style.display = "none";
  }

  // === Receipt Body ===
  const tbody = document.getElementById("receiptItemRows");
  tbody.innerHTML = "";

  cartItems.forEach((item) => {
    const discountText =
      item.discount && item.discount > 0
        ? `<br><small>Disc: ${item.discount}%</small>`
        : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}${discountText}</td>
      <td>${item.quantity}</td>
      <td>Rs ${item.price.toFixed(2)}</td>
      <td>Rs ${getItemTotal(item).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  // === Shop Copy Section ===
  document.getElementById("shopCopyOrderId").textContent = orderNo;
  document.getElementById("shopCopyDate").textContent = dateStr;
  document.getElementById("shopCopyCustomer").textContent = customerName;
  document.getElementById("shopCopyMethod").textContent =
    paymentMethod.toUpperCase();
  document.getElementById("shopCopyTotal").textContent = total.toFixed(2);

  if (paymentMethod === "cash" && cashInAmount !== null) {
    document.getElementById("shopCopyCashInWrap").style.display = "block";
    document.getElementById("shopCopyCashIn").textContent =
      cashInAmount.toFixed(2);
  } else {
    document.getElementById("shopCopyCashInWrap").style.display = "none";
  }

  // ✅ Show receipt modal
  document.getElementById("receiptModal").style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

//REPORT GENERATING

// 🧾 Daily Sales Summary Report
async function getDailySalesSummary(sessionId) {
  try {
    const posOrders = await axios.get(`${orderApi}/session/${sessionId}`);
    if (!posOrders.data.length) return { summary: "No transactions" };

    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalOrders = posOrders.data.length;
    let itemsSold = 0;

    posOrders.data.forEach((order) => {
      totalRevenue += parseFloat(order.total || 0);
      totalDiscount += parseFloat(order.discount || 0);
      itemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0); // Summing items sold
    });

    return {
      totalOrders,
      itemsSold,
      totalRevenue: totalRevenue.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
    };
  } catch (error) {
    console.error("Error generating daily sales summary:", error);
    return { summary: "Error generating report" };
  }
}

// 🛍️ Detailed Sales Transactions
async function getDetailedTransactions(sessionId) {
  try {
    const posOrders = await axios.get(`${orderApi}/session/${sessionId}`);
    if (!posOrders.data.length) return { details: "No transactions" };

    return posOrders.data.map((order) => ({
      id: order.id,
      customer: order.customer_id || "Guest",
      date: order.order_date,
      time: order.order_time,
      total: order.total,
      discount: order.discount,
    }));
  } catch (error) {
    console.error("Error generating detailed transactions:", error);
    return { details: "Error generating report" };
  }
}

// 📦 Sold Items Breakdown
async function getSoldItemsBreakdown(sessionId) {
  try {
    // Fetch orders for the session, which includes order items
    const posOrders = await axios.get(`${orderApi}/session/${sessionId}`);

    // Check if there are no orders found
    if (!posOrders.data || posOrders.data.length === 0) {
      return { breakdown: "No transactions" };
    }

    // Create an object to group items by inventory_id and price
    const grouped = {};

    // Loop through each order and its items
    posOrders.data.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${item.inventory_id}-${item.price}`;

        // If the item doesn't exist in the grouped object, initialize it
        if (!grouped[key]) {
          grouped[key] = {
            inventoryId: item.inventory_id,
            price: item.price,
            quantity: 0,
            discount: item.discount,
          };
        }

        // Add the quantity of the item to the grouped data
        grouped[key].quantity += item.quantity;
      });
    });

    // Convert the grouped object into an array of breakdowns
    return Object.values(grouped);
  } catch (error) {
    console.error("Error generating sold items breakdown:", error);
    return { breakdown: "Error generating report" };
  }
}

// 💵 Cash Movement Report
async function getCashMovementReport(sessionId) {
  try {
    const res = await axios.get(`${cashApi}/session/${sessionId}`);
    const data = res.data.filter((entry) => entry.order_id === null);
    if (!data.length) return { cashMovements: "No transactions" };

    return data.map((entry) => ({
      type: entry.type,
      reason: entry.reason,
      amount: entry.amount,
      date: entry.date,
      time: entry.time,
    }));
  } catch (error) {
    console.error("Error generating cash movement report:", error);
    return { cashMovements: "Error generating report" };
  }
}

// 💳 Payment Method Summary
async function getPaymentMethodSummary(sessionId) {
  try {
    // Step 1: Get all orders for the session
    const orderRes = await axios.get(`${orderApi}/session/${sessionId}`);
    const orders = orderRes.data;
    const orderIds = orders.map((o) => o.id);

    if (orderIds.length === 0) {
      return {}; // No orders, so no payments
    }

    // Step 2: Get all payments
    const paymentRes = await axios.get(paymentApi);
    const payments = paymentRes.data.filter((p) =>
      orderIds.includes(p.order_id)
    );

    if (!payments.length) return {};

    // Step 3: Aggregate totals per method
    const methodTotals = {};
    payments.forEach((p) => {
      const method = p.method;
      methodTotals[method] =
        (methodTotals[method] || 0) + parseFloat(p.amount);
    });

    return methodTotals;
  } catch (error) {
    console.error("Error generating payment method summary:", error);
    return {};
  }
}


// 🧮 Discount Report
async function getDiscountReport(sessionId) {
  try {
    // Fetch orders for the session, which already includes items
    const posOrders = await axios.get(`${orderApi}/session/${sessionId}`);

    // If no orders are found
    if (!posOrders.data || posOrders.data.length === 0) {
      return { discounts: "No transactions" };
    }

    // Separate order-level and item-level discounts
    const orderDiscounts = [];
    const itemDiscounts = [];

    posOrders.data.forEach((order) => {
      // Bill-wide discount
      if (order.discount > 0) {
        orderDiscounts.push({
          orderId: order.id,
          discount: order.discount,
          total: order.total,
        });
      }

      // Item-level discounts
      order.items.forEach((item) => {
        if (item.discount > 0) {
          itemDiscounts.push({
            orderId: order.id,
            itemId: item.inventory_id,
            discount: item.discount,
            subtotal: item.subtotal,
          });
        }
      });
    });

    if (!orderDiscounts.length && !itemDiscounts.length) {
      return { discounts: "No discounts used" };
    }

    return {
      billWideDiscounts: orderDiscounts,
      itemLevelDiscounts: itemDiscounts,
    };
  } catch (error) {
    console.error("Error generating discount report:", error);
    return { discounts: "Error generating report" };
  }
}

// Function to generate CSV from report data
function generateCSV() {
  const sessionId = currentSessionId; // Assuming the session ID is available

  // Fetch report data - using Promise.allSettled instead of Promise.all
  // This ensures all promises complete regardless of success/failure
  Promise.allSettled([
    getDailySalesSummary(sessionId),
    getDetailedTransactions(sessionId),
    getSoldItemsBreakdown(sessionId),
    getCashMovementReport(sessionId),
    getPaymentMethodSummary(sessionId),
    getDiscountReport(sessionId),
  ])
    .then((results) => {
      // Extract values, providing fallbacks for rejected promises
      const [
        dailySalesResult,
        detailedTransactionsResult,
        soldItemsResult,
        cashMovementResult,
        paymentMethodSummaryResult,
        discountReportResult,
      ] = results;

      // Safely extract data or use fallbacks
      const dailySales = dailySalesResult.status === 'fulfilled' ? dailySalesResult.value : { summary: "No data available" };
      const detailedTransactions = detailedTransactionsResult.status === 'fulfilled' ? detailedTransactionsResult.value : { details: "No data available" };
      const soldItems = soldItemsResult.status === 'fulfilled' ? soldItemsResult.value : { breakdown: "No data available" };
      const cashMovement = cashMovementResult.status === 'fulfilled' ? cashMovementResult.value : { cashMovements: "No data available" };
      const paymentMethodSummary = paymentMethodSummaryResult.status === 'fulfilled' ? paymentMethodSummaryResult.value : { summary: "No data available" };
      const discountReport = discountReportResult.status === 'fulfilled' ? discountReportResult.value : { discounts: "No data available" };

      // Prepare the CSV data
      let csvData = [];

      // 🧾 Daily Sales Summary Report
      csvData.push("Daily Sales Summary Report");
      csvData.push("Total Orders,Items Sold,Total Revenue,Total Discount");
      if (dailySales.totalOrders !== undefined && dailySales.itemsSold !== undefined) {
        csvData.push(
          `${dailySales.totalOrders},${dailySales.itemsSold},${dailySales.totalRevenue},${dailySales.totalDiscount}`
        );
      } else {
        csvData.push("0,0,0.00,0.00"); // If no sales data, put zeros
      }
      csvData.push(""); // Blank line between sections

      // 🛍️ Detailed Sales Transactions
      csvData.push("Detailed Sales Transactions");
      csvData.push("Order ID,Customer,Date,Time,Total,Discount");
      if (Array.isArray(detailedTransactions) && detailedTransactions.length > 0) {
        detailedTransactions.forEach((order) => {
          csvData.push(
            `${order.id || "N/A"},${order.customer || "N/A"},${order.date || "N/A"},${order.time || "N/A"},${order.total || "0.00"},${order.discount || "0.00"}`
          );
        });
      } else {
        csvData.push("No Data,No Data,No Data,No Data,No Data,No Data");
      }
      csvData.push(""); // Blank line between sections

      // 📦 Sold Items Breakdown
      csvData.push("Sold Items Breakdown");
      csvData.push("Inventory ID,Price,Quantity,Discount");
      if (Array.isArray(soldItems) && soldItems.length > 0) {
        soldItems.forEach((item) => {
          csvData.push(
            `${item.inventoryId || "N/A"},${item.price || "0.00"},${item.quantity || "0"},${item.discount || "0.00"}`
          );
        });
      } else {
        csvData.push("No Data,No Data,No Data,No Data");
      }
      csvData.push(""); // Blank line between sections

      // 💵 Cash Movement Report
      csvData.push("Cash Movement Report");
      csvData.push("Type,Reason,Amount,Date,Time");
      if (Array.isArray(cashMovement) && cashMovement.length > 0) {
        cashMovement.forEach((entry) => {
          csvData.push(
            `${entry.type || "N/A"},${entry.reason || "N/A"},${entry.amount || "0.00"},${entry.date || "N/A"},${entry.time || "N/A"}`
          );
        });
      } else {
        csvData.push("No Data,No Data,No Data,No Data,No Data");
      }
      csvData.push(""); // Blank line between sections

      // 💳 Payment Method Summary
      csvData.push("Payment Method Summary");
      csvData.push("Payment Method,Amount");
      if (paymentMethodSummary && typeof paymentMethodSummary === 'object' && Object.keys(paymentMethodSummary).length > 0) {
        for (const method in paymentMethodSummary) {
          if (method !== 'summary') { // Skip the summary property if it exists
            const amount = parseFloat(paymentMethodSummary[method]);
            // Check if the amount is a valid number
            if (!isNaN(amount)) {
              csvData.push(`${method},${amount.toFixed(2)}`);
            } else {
              csvData.push(`${method},0.00`);
            }
          }
        }
      } else {
        csvData.push("No Data,0.00");
      }
      csvData.push(""); // Blank line between sections

      // 🧮 Discount Report
      csvData.push("Discount Report");
      csvData.push("Order ID,Discount,Total (Order Level),Item ID,Item Discount,Subtotal (Item Level)");
      
      // Handle potential undefined or non-array structure for discount report
      const billWideDiscounts = discountReport && Array.isArray(discountReport.billWideDiscounts) 
        ? discountReport.billWideDiscounts 
        : [];
        
      const itemLevelDiscounts = discountReport && Array.isArray(discountReport.itemLevelDiscounts) 
        ? discountReport.itemLevelDiscounts 
        : [];

      if (billWideDiscounts.length > 0) {
        billWideDiscounts.forEach((discount) => {
          csvData.push(
            `${discount.orderId || "N/A"},${discount.discount || "0.00"},${discount.total || "0.00"},,`
          );
        });
      }
      
      if (itemLevelDiscounts.length > 0) {
        itemLevelDiscounts.forEach((discount) => {
          csvData.push(
            `, , ,${discount.itemId || "N/A"},${discount.discount || "0.00"},${discount.subtotal || "0.00"}`
          );
        });
      }
      
      if (billWideDiscounts.length === 0 && itemLevelDiscounts.length === 0) {
        csvData.push("No Data,No Data,No Data,No Data,No Data,No Data");
      }

      // Convert array to CSV string
      const csvString = csvData.join("\n");

      // Download the CSV file
      const blob = new Blob([csvString], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `POS_Report_${new Date().toLocaleDateString()}.csv`;
      link.click();
    })
    .catch((err) => {
      console.error("❌ Error generating CSV report:", err);
      
      // Even if something fails completely, generate a basic report
      let csvData = [
        "POS Report - Error Encountered",
        "",
        "An error occurred while generating the full report.",
        "Basic report structure is provided below with no data.",
        "",
        "Daily Sales Summary Report",
        "Total Orders,Items Sold,Total Revenue,Total Discount",
        "No Data,No Data,No Data,No Data",
        "",
        "Detailed Sales Transactions",
        "Order ID,Customer,Date,Time,Total,Discount",
        "No Data,No Data,No Data,No Data,No Data,No Data",
        "",
        "Sold Items Breakdown",
        "Inventory ID,Price,Quantity,Discount", 
        "No Data,No Data,No Data,No Data",
        "",
        "Cash Movement Report",
        "Type,Reason,Amount,Date,Time",
        "No Data,No Data,No Data,No Data,No Data",
        "",
        "Payment Method Summary", 
        "Payment Method,Amount",
        "No Data,No Data",
        "",
        "Discount Report",
        "Order ID,Discount,Total (Order Level),Item ID,Item Discount,Subtotal (Item Level)",
        "No Data,No Data,No Data,No Data,No Data,No Data"
      ];
      
      // Convert array to CSV string
      const csvString = csvData.join("\n");

      // Download the CSV file
      const blob = new Blob([csvString], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `POS_Report_ERROR_${new Date().toLocaleDateString()}.csv`;
      link.click();
      
      alert("There was an error generating the complete report. A basic report structure has been downloaded.");
    });
}
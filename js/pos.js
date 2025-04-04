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
const returnApi = "http://localhost:3000/api/return";
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
  document.getElementById("exchangeBtn").addEventListener("click", () => {
    if (!sessionActive) return alert("❌ Start a session first.");
    document.getElementById("exchangeModal").style.display = "flex";
    document.getElementById("exchangeBarcode").focus();
  });

  document
    .getElementById("exchangeBarcode")
    .addEventListener("keypress", async (e) => {
      if (e.key !== "Enter") return;

      const code = e.target.value.trim();
      if (!code) return;

      try {
        const inv = (await axios.get(`${inventoryApi}/barcode/${code}`)).data;
        const product = (await axios.get(`${productApi}/${inv.productId}`))
          .data;
        const allStocks = (await axios.get(stockApi)).data;
        const stockOptions = allStocks.filter((s) => s.inventoryId === inv.id);

        const container = document.getElementById("exchangePriceOptions");
        container.innerHTML = "";

        if (stockOptions.length === 1) {
          container.innerHTML = `<p>Selected Price: Rs ${stockOptions[0].sell_price}</p>`;
          container.dataset.stockId = stockOptions[0].id;
          container.dataset.price = stockOptions[0].sell_price;
        } else {
          stockOptions.forEach((s) => {
            const btn = document.createElement("button");
            btn.textContent = `Rs ${s.sell_price}`;
            btn.onclick = () => {
              container.innerHTML = `<p>Selected Price: Rs ${s.sell_price}</p>`;
              container.dataset.stockId = s.id;
              container.dataset.price = s.sell_price;
            };
            container.appendChild(btn);
          });
        }
      } catch (err) {
        console.error("Exchange barcode error:", err);
        alert("❌ Item not found.");
      }
    });

    document.getElementById("submitExchangeBtn").addEventListener("click", async () => {
      const barcode = document.getElementById("exchangeBarcode").value.trim();
      const quantity = parseInt(document.getElementById("exchangeQuantity").value);
      const restock = document.getElementById("exchangeRestock").value === "true";
    
      const priceOptionsContainer = document.getElementById("exchangePriceOptions");
      const stockId = priceOptionsContainer.dataset.stockId;
      const price = parseFloat(priceOptionsContainer.dataset.price);
    
      if (!barcode || !stockId || isNaN(quantity) || isNaN(price)) {
        return alert("❌ Please complete the exchange form.");
      }
    
      try {
        const inv = (await axios.get(`${inventoryApi}/barcode/${barcode}`)).data;
        const now = new Date();
        const date = now.toISOString().split("T")[0];
        const time = now.toTimeString().split(" ")[0];
    
        const returnRes = await axios.post(returnApi, {
          session_id: currentSessionId,
          inventory_id: inv.id,
          quantity,
          price,
          date,
          time,
          processed_by: "POS Operator",
          restock,
          status: "unused" 
        });
    
        // ✅ If restock is selected, update stock quantity
        if (restock) {
          const stock = await axios.get(`${stockApi}/${stockId}`);
          const updatedQty = stock.data.quantity + quantity;
          await axios.put(`${stockApi}/update-quantity/${stockId}`, {
            quantity: updatedQty,
          });
        }
    
        // ✅ Render Return Receipt Modal
        const returnData = returnRes.data;
        const totalPrice = (returnData.quantity * returnData.price).toFixed(2);
    
        // Customer Copy
        document.getElementById("returnId").textContent = returnData.id;
        document.getElementById("returnItemName").textContent = inv.name || "Unnamed Item";
        document.getElementById("returnQty").textContent = returnData.quantity;
        document.getElementById("returnPrice").textContent = returnData.price.toFixed(2);
        document.getElementById("returnTotal").textContent = totalPrice;
        document.getElementById("returnDate").textContent = returnData.date;
        document.getElementById("returnTime").textContent = returnData.time;
        document.getElementById("returnProcessedBy").textContent = returnData.processed_by;
    
        // Shop Copy
        document.getElementById("shopReturnId").textContent = returnData.id;
        document.getElementById("shopReturnItem").textContent = inv.name || "Unnamed Item";
        document.getElementById("shopReturnQty").textContent = returnData.quantity;
        document.getElementById("shopReturnPrice").textContent = returnData.price.toFixed(2);
        document.getElementById("shopReturnTotal").textContent = totalPrice;
        document.getElementById("shopReturnRestocked").textContent = returnData.restock ? "Yes" : "No";
        document.getElementById("shopReturnDate").textContent = returnData.date;
        document.getElementById("shopReturnTime").textContent = returnData.time;
        document.getElementById("shopReturnProcessedBy").textContent = returnData.processed_by;
    
        closeModal("exchangeModal");
        document.getElementById("returnReceiptModal").style.display = "flex";
    
      } catch (err) {
        console.error("❌ Error processing exchange:", err);
        alert("Error during exchange.");
      }
    });
    

    document.getElementById("exchangeIdInput").addEventListener("keypress", async (e) => {
      if (e.key !== "Enter") return;
    
      const exchangeId = parseInt(e.target.value.trim());
      if (!exchangeId || isNaN(exchangeId)) return alert("❌ Invalid Exchange ID");
    
      try {
        const returnData = (await axios.get(`${returnApi}/${exchangeId}`)).data;
        console.log("Return Data:", returnData);

        // ✅ Check if already used
        if (returnData.status !== "unused") {
          return alert("❌ This exchange has already been used.");
        }
    
        const returnValue = returnData.price * returnData.quantity;
        const cartTotal = getCartTotal();
    
        const container = document.getElementById("exchangePaymentDetails");
        const actions = document.getElementById("exchangePaymentActions");
    
        container.innerHTML = `
          <p><strong>Return Value:</strong> Rs ${returnValue.toFixed(2)}</p>
          <p><strong>Cart Total:</strong> Rs ${cartTotal.toFixed(2)}</p>
        `;
    
        actions.innerHTML = ""; // Clear previous buttons
    
        if (cartTotal > returnValue) {
          const diff = (cartTotal - returnValue).toFixed(2);
          container.innerHTML += `<p><strong>Customer Needs to Pay:</strong> Rs ${diff}</p>`;
    
          const payByCashBtn = document.createElement("button");
          payByCashBtn.textContent = "Pay by Cash";
          payByCashBtn.onclick = () => {
            closeModal("exchangePayModal"); // 👈 close first
            showExchangeCashModal(diff, exchangeId);
          };
          
          
    
          const payByCardBtn = document.createElement("button");
          payByCardBtn.textContent = "Pay by Card";
          payByCardBtn.onclick = () => {
            closeModal('exchangePayModal');
            document.getElementById("cardDueTotal").textContent = cartTotal.toFixed(2);
            document.getElementById("cardConfirmBtn").onclick = () => {
              const confirmCard = confirm("Simulate successful card transaction?");
              if (confirmCard) {
                finalizeExchangePayment("card", cartTotal, exchangeId);
              }
            };
            document.getElementById("cardModal").style.display = "flex";
          };
          
          
    
          actions.appendChild(payByCashBtn);
          actions.appendChild(payByCardBtn);
        } else {
          container.innerHTML += `<p><strong>No Payment Required.</strong></p>`;
    
          const completeBtn = document.createElement("button");
          completeBtn.textContent = "Finalize Exchange";
          completeBtn.onclick = () => finalizeExchangePayment("ex", returnValue, exchangeId);
    
          actions.appendChild(completeBtn);
        }
      } catch (err) {
        console.error("Exchange Payment Error:", err);
        alert("❌ Exchange not found.");
      }
    });

    // 💰 Live Balance and Validation
document.getElementById("exchangeCashIn").addEventListener("input", () => {
  const due = parseFloat(document.getElementById("exchangeCashModal").dataset.dueAmount);
  const cashIn = parseFloat(document.getElementById("exchangeCashIn").value);
  const balance = (cashIn - due).toFixed(2);

  document.getElementById("exchangeCashBalance").textContent = balance >= 0 ? balance : "0.00";

  if (!isNaN(cashIn) && cashIn >= due) {
    document.getElementById("confirmExchangeCashPaymentBtn").style.display = "inline-block";
  } else {
    document.getElementById("confirmExchangeCashPaymentBtn").style.display = "none";
  }
});

// ✅ Confirm Exchange Payment
document.getElementById("confirmExchangeCashPaymentBtn").addEventListener("click", () => {
  const modal = document.getElementById("exchangeCashModal");
  const exchangeId = modal.dataset.exchangeId;
  const due = parseFloat(modal.dataset.dueAmount);
  const cashIn = parseFloat(document.getElementById("exchangeCashIn").value);

  closeModal("exchangeCashModal");

  finalizeExchangePayment("cash", due, exchangeId, cashIn);
});
document.getElementById("cardConfirmBtn").addEventListener("click", () => {
  const confirm = confirm("Simulate successful card transaction?");
  if (confirm) {
    finalizePayment("card");
  }
});
document.getElementById("confirmExchangeCardBtn").addEventListener("click", () => {
  const modal = document.getElementById("exchangeCardModal");
  const exchangeId = modal.dataset.exchangeId;
  const amount = parseFloat(modal.dataset.amount);

  closeModal("exchangeCardModal");
  finalizeExchangePayment("card", amount, exchangeId);
});


    
    
});
function showExchangeCashModal(dueAmount, exchangeId) {
  // Show values in modal
  document.getElementById("exchangeDueAmount").textContent = dueAmount;
  document.getElementById("exchangeCashIn").value = "";
  document.getElementById("exchangeCashBalance").textContent = "0.00";
  document.getElementById("confirmExchangeCashPaymentBtn").style.display = "none";

  // Save needed data
  const modal = document.getElementById("exchangeCashModal");
  modal.dataset.exchangeId = exchangeId;
  modal.dataset.dueAmount = dueAmount;

  // Open modal
  modal.style.display = "flex";
}


function printReceipt(modalId) {
  // First remove printing class from all modals
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.remove("modal-printing");
  });

  // Add printing class to the specific modal
  document.getElementById(modalId).classList.add("modal-printing");

  // Print
  window.print();

  // Optional: Remove the class after printing
  setTimeout(() => {
    document.getElementById(modalId).classList.remove("modal-printing");
  }, 500);
}
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
      ...(email && { email }), // spread email only if provided
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

    case "bank":
      document.getElementById("cardDueTotal").textContent =
        getCartTotal().toFixed(2);
      document.getElementById("cardModal").style.display = "flex";
      break;

    case "ex":
      document.getElementById("exchangeIdInput").value = "";
      document.getElementById("exchangePaymentDetails").innerHTML = "";
      document.getElementById("exchangePaymentActions").innerHTML = "";
      document.getElementById("exchangePayModal").style.display = "flex";
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
async function finalizePayment(method, cashInAmount = 0, exchangeId = null, totalOverride = null) {
  try {
    const now = new Date();
    const total = totalOverride ?? getCartTotal();
    const billDiscount = parseFloat(
      document.getElementById("billDiscount")?.value || 0
    );

    const orderRes = await axios.post(orderApi, {
      session_id: currentSessionId,
      order_date: now.toISOString().split("T")[0],
      order_time: now.toTimeString().split(" ")[0],
      customer_id: selectedCustomerId,
      discount: billDiscount,
      total,
    });

    const orderId = orderRes.data.id;

    for (const item of cartItems) {
      await axios.post(orderItemApi, {
        order_id: orderId,
        inventory_id: item.id,
        stock_movement_id: item.stockMovementId || null,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount || 0,
        subtotal: getItemTotal(item),
      });

      if (item.stockMovementId) {
        const stock = await axios.get(`${stockApi}/${item.stockMovementId}`);
        const updatedQty = stock.data.quantity - item.quantity;
        await axios.put(`${stockApi}/update-quantity/${item.stockMovementId}`, {
          quantity: updatedQty < 0 ? 0 : updatedQty,
        });
      }
    }

    // ✅ If it's part of an exchange, mark the return used
    if (exchangeId) {
      await axios.put(`${returnApi}/${exchangeId}`, {
        status: "used",
      });
    }

    await axios.post(paymentApi, {
      order_id: orderId,
      method,
      amount: total,
    });

    if (method === "cash") {
      const date = now.toISOString().split("T")[0];
      const time = now.toTimeString().split(" ")[0];

      await recordCashTransaction({
        session_id: currentSessionId,
        order_id: orderId,
        type: "in",
        reason: exchangeId ? "Cash - Exchange Payment" : "Cash Payment",
        amount: total,
        date,
        time,
        recorded_by: "POS Operator",
      });
    }

    // Save cart items before clearing
    const itemsForReceipt = [...cartItems];
    
    cartItems = [];
    renderCart();
    updateOrderNumber();
    resetCustomerData();
    const billDiscountField = document.getElementById("billDiscount");
    if (billDiscountField) {
      billDiscountField.value = "0";
    }

    closeModal("exchangePayModal");
    closeModal("cashModal");
    closeModal("cardModal");

    // Pass the saved items to the receipt
    renderReceiptAndShopCopy(orderId, selectedCustomerId, method, cashInAmount, total, itemsForReceipt);
  } catch (err) {
    console.error("❌ Finalization failed:", err);
    alert("Error completing transaction.");
  }
}
function resetCustomerData() {
  // Clear selected customer ID
  selectedCustomerId = null;

  // Clear customer input fields
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerName").value = "";
  document.getElementById("customerEmail").value = "";

  // Hide the new customer registration fields
  const newFields = document.getElementById("newCustomerFields");
  if (newFields) {
    newFields.style.display = "none";
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
  // Pass the cart items
  finalizePayment("card");
}

function finalizeExchangePayment(method, amount, exchangeId, cashInAmount = null) {
  // Pass the cart items
  finalizePayment(method, cashInAmount, exchangeId, amount);
}

function renderReceiptAndShopCopy(
  orderId,
  customerId,
  paymentMethod,
  cashInAmount = null,
  totalAmount = null,
  items = []
) {
  const date = new Date();
  const orderNo = String(orderId).padStart(5, "0");
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const total = totalAmount ?? getCartTotal(); // ✅ use passed amount if available
  const customerName = customerId ? `#${customerId}` : "Guest";

  const billDiscount = parseFloat(
    document.getElementById("billDiscount")?.value || 0
  );

  document.getElementById("receiptOrderNumber").textContent = orderNo;
  document.getElementById("receiptCustomerId").textContent = customerName;
  document.getElementById("receiptDate").textContent = dateStr;
  document.getElementById("receiptTime").textContent = timeStr;
  document.getElementById("receiptPaymentMethod").textContent =
    paymentMethod.toUpperCase();
  document.getElementById("receiptTotal").textContent = total.toFixed(2);

  if (billDiscount > 0) {
    document.getElementById("receiptBillDiscountWrap").style.display = "block";
    document.getElementById("receiptBillDiscount").textContent = billDiscount;
  } else {
    document.getElementById("receiptBillDiscountWrap").style.display = "none";
  }

  // Receipt body
  const tbody = document.getElementById("receiptItemRows");
  tbody.innerHTML = "";

  items.forEach((item) => {
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

  // Shop copy
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

  document.getElementById("receiptModal").style.display = "flex";
}


function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function renderReturnReceiptAndShopCopy(returnData) {
  document.getElementById("returnId").textContent = returnData.id;
  document.getElementById("returnItemName").textContent =
    returnData.inventory_name || "N/A";
  document.getElementById("returnQty").textContent = returnData.quantity;
  document.getElementById("returnPrice").textContent = `Rs. ${parseFloat(
    returnData.price
  ).toFixed(2)}`;
  document.getElementById("returnRestocked").textContent = returnData.restock
    ? "Yes"
    : "No";
  document.getElementById("returnDate").textContent = returnData.date;
  document.getElementById("returnTime").textContent = returnData.time;
  document.getElementById("returnProcessedBy").textContent =
    returnData.processed_by || "POS Operator";

  document.getElementById("returnReceiptModal").style.display = "flex";
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
      methodTotals[method] = (methodTotals[method] || 0) + parseFloat(p.amount);
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

// 🔁 Returns Report
async function getReturnsReport(sessionId) {
  try {
    const res = await axios.get(`${returnApi}/session/${sessionId}`);
    if (!res.data || res.data.length === 0) {
      return { returns: "No returns recorded" };
    }

    return res.data.map((item) => ({
      inventoryId: item.inventory_id,
      quantity: item.quantity,
      price: item.price,
      restock: item.restock ? "Yes" : "No",
      date: item.date,
      time: item.time,
      processedBy: item.processed_by,
    }));
  } catch (error) {
    console.error("Error fetching returns report:", error);
    return { returns: "Error generating returns report" };
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
    getReturnsReport(sessionId),
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
        returnsReportResult,
      ] = results;

      // Safely extract data or use fallbacks
      const dailySales =
        dailySalesResult.status === "fulfilled"
          ? dailySalesResult.value
          : { summary: "No data available" };
      const detailedTransactions =
        detailedTransactionsResult.status === "fulfilled"
          ? detailedTransactionsResult.value
          : { details: "No data available" };
      const soldItems =
        soldItemsResult.status === "fulfilled"
          ? soldItemsResult.value
          : { breakdown: "No data available" };
      const cashMovement =
        cashMovementResult.status === "fulfilled"
          ? cashMovementResult.value
          : { cashMovements: "No data available" };
      const paymentMethodSummary =
        paymentMethodSummaryResult.status === "fulfilled"
          ? paymentMethodSummaryResult.value
          : { summary: "No data available" };
      const discountReport =
        discountReportResult.status === "fulfilled"
          ? discountReportResult.value
          : { discounts: "No data available" };
      const returnsReport =
        returnsReportResult.status === "fulfilled"
          ? returnsReportResult.value
          : { returns: "No data available" };

      // Prepare the CSV data
      let csvData = [];

      // 🧾 Daily Sales Summary Report
      csvData.push("Daily Sales Summary Report");
      csvData.push("Total Orders,Items Sold,Total Revenue,Total Discount");
      if (
        dailySales.totalOrders !== undefined &&
        dailySales.itemsSold !== undefined
      ) {
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
      if (
        Array.isArray(detailedTransactions) &&
        detailedTransactions.length > 0
      ) {
        detailedTransactions.forEach((order) => {
          csvData.push(
            `${order.id || "N/A"},${order.customer || "N/A"},${
              order.date || "N/A"
            },${order.time || "N/A"},${order.total || "0.00"},${
              order.discount || "0.00"
            }`
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
            `${item.inventoryId || "N/A"},${item.price || "0.00"},${
              item.quantity || "0"
            },${item.discount || "0.00"}`
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
            `${entry.type || "N/A"},${entry.reason || "N/A"},${
              entry.amount || "0.00"
            },${entry.date || "N/A"},${entry.time || "N/A"}`
          );
        });
      } else {
        csvData.push("No Data,No Data,No Data,No Data,No Data");
      }
      csvData.push(""); // Blank line between sections

      // 💳 Payment Method Summary
      csvData.push("Payment Method Summary");
      csvData.push("Payment Method,Amount");
      if (
        paymentMethodSummary &&
        typeof paymentMethodSummary === "object" &&
        Object.keys(paymentMethodSummary).length > 0
      ) {
        for (const method in paymentMethodSummary) {
          if (method !== "summary") {
            // Skip the summary property if it exists
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
      csvData.push(
        "Order ID,Discount,Total (Order Level),Item ID,Item Discount,Subtotal (Item Level)"
      );

      // Handle potential undefined or non-array structure for discount report
      const billWideDiscounts =
        discountReport && Array.isArray(discountReport.billWideDiscounts)
          ? discountReport.billWideDiscounts
          : [];

      const itemLevelDiscounts =
        discountReport && Array.isArray(discountReport.itemLevelDiscounts)
          ? discountReport.itemLevelDiscounts
          : [];

      if (billWideDiscounts.length > 0) {
        billWideDiscounts.forEach((discount) => {
          csvData.push(
            `${discount.orderId || "N/A"},${discount.discount || "0.00"},${
              discount.total || "0.00"
            },,`
          );
        });
      }

      if (itemLevelDiscounts.length > 0) {
        itemLevelDiscounts.forEach((discount) => {
          csvData.push(
            `, , ,${discount.itemId || "N/A"},${discount.discount || "0.00"},${
              discount.subtotal || "0.00"
            }`
          );
        });
      }

      if (billWideDiscounts.length === 0 && itemLevelDiscounts.length === 0) {
        csvData.push("No Data,No Data,No Data,No Data,No Data,No Data");
      }

      // 🔁 Returns Report
      csvData.push("Returns Report");
      csvData.push(
        "Inventory ID,Quantity,Price,Restock,Date,Time,Processed By"
      );

      if (Array.isArray(returnsReport) && returnsReport.length > 0) {
        returnsReport.forEach((item) => {
          csvData.push(
            `${item.inventoryId || "N/A"},${item.quantity || "0"},${
              item.price || "0.00"
            },${item.restock || "No"},${item.date || "N/A"},${
              item.time || "N/A"
            },${item.processedBy || "N/A"}`
          );
        });
      } else {
        csvData.push("No Data,No Data,No Data,No Data,No Data,No Data,No Data");
      }

      csvData.push(""); // Blank line between sections

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
        "No Data,No Data,No Data,No Data,No Data,No Data",
      ];

      // Convert array to CSV string
      const csvString = csvData.join("\n");

      // Download the CSV file
      const blob = new Blob([csvString], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `POS_Report_ERROR_${new Date().toLocaleDateString()}.csv`;
      link.click();

      alert(
        "There was an error generating the complete report. A basic report structure has been downloaded."
      );
    });
}

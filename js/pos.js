// API Endpoints
const sessionApi = "http://localhost:3000/api/pos-session";
const orderApi = "http://localhost:3000/api/pos-order";
const orderItemApi = "http://localhost:3000/api/pos-order-item";
const paymentApi = "http://localhost:3000/api/pos-payment";
const inventoryApi = "http://localhost:3000/api/inventory";
const customerApi = "http://localhost:3000/api/customer";
const productApi = "http://localhost:3000/api/products";
const stockApi = "http://localhost:3000/api/stock-movements";

// Global variables
let sessionActive = false;
let startupCash = 0;
let currentSessionId = null;
const sessionPassword = "9155";
let cartItems = [];
let cashValidationPassed = false;
let expectedCashIn = 0;
let changeAmount = 0;
let selectedCustomerId = null;

// Session Handling
checkActiveSession();

async function checkActiveSession() {
  try {
    const res = await axios.get(`${sessionApi}/active`);
    const session = res.data;

    // If session found, populate session state
    sessionActive = true;
    startupCash = parseFloat(session.startup_cash || 0);
    currentSessionId = session.id;

    document.getElementById("startDayBtn").disabled = true;
    document.getElementById("closeDayBtn").disabled = false;

    document.getElementById(
      "sessionStatus"
    ).textContent = `✅ Resumed Session | Started at ${
      session.start_time
    } | Cash: Rs. ${startupCash.toFixed(2)}`;
    document.getElementById("sessionStatus").style.color = "#4caf50";
  } catch (error) {
    // No active session, allow starting a new one
    console.log("No active session found.");
    sessionActive = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Session buttons
  const startBtn = document.getElementById("startDayBtn");
  const closeBtn = document.getElementById("closeDayBtn");

  if (startBtn) {
    startBtn.addEventListener("click", startNewSession);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeCurrentSession);
  }

  // Clear cart
  document.getElementById("clearCartBtn").addEventListener("click", () => {
    if (confirm("Clear all items from cart?")) {
      cartItems = [];
      renderCart();
    }
  });

  // Barcode scanner
  document
    .getElementById("barcodeInput")
    .addEventListener("keypress", async function (e) {
      if (e.key === "Enter") {
        const barcode = e.target.value.trim();
        if (!barcode) return;

        try {
          const inventoryRes = await axios.get(
            `${inventoryApi}/barcode/${barcode}`
          );
          const inventory = inventoryRes.data;

          const productRes = await axios.get(
            `${productApi}/${inventory.productId}`
          );
          const product = productRes.data;

          const stockRes = await axios.get(`${stockApi}`);
          const stockMovements = stockRes.data;

          // ✅ FILTER VALID MOVEMENTS
          const validMovements = stockMovements.filter(
            (m) => m.inventoryId === inventory.id && m.quantity > 0
          );

          if (validMovements.length === 0) {
            alert("❌ No stock available for this item.");
            return;
          }

          if (validMovements.length === 1) {
            const selected = validMovements[0];
            const item = {
              id: inventory.id,
              name: product.name,
              price: parseFloat(selected.sell_price),
              quantity: 1,
              total: parseFloat(selected.sell_price),
              stockMovementId: selected.id,
            };
            addToCart(item);
          } else {
            // Show modal with multiple price options
            showPriceSelectionModal(
              product.name,
              validMovements,
              inventory,
              product
            );
          }

          e.target.value = "";
        } catch (err) {
          console.error("Error loading item:", err);
          alert("❌ Item not found or missing data.");
        }
      }
    });

  // Checkout Button
  document.getElementById("checkoutBtn").addEventListener("click", () => {
    if (cartItems.length === 0) return alert("No items in cart.");
    document.getElementById("customerModal").style.display = "flex";
  });
  document
    .getElementById("searchCustomerBtn")
    .addEventListener("click", async () => {
      const phone = document.getElementById("customerPhone").value.trim();
      if (!phone) return alert("Enter mobile number");

      try {
        const res = await axios.get(`${customerApi}/phone/${phone}`);
        selectedCustomerId = res.data.id;
        closeModal("customerModal");
        document.getElementById("cashTotalDisplay").textContent =
          getCartTotal().toFixed(2);
        document.getElementById("paymentModal").style.display = "flex";
      } catch (err) {
        document.getElementById("newCustomerFields").style.display = "block";
      }
    });

  document
    .getElementById("registerCustomerBtn")
    .addEventListener("click", async () => {
      const name = document.getElementById("customerName").value.trim();
      const email = document.getElementById("customerEmail").value.trim();
      const phone = document.getElementById("customerPhone").value.trim();

      if (!name || !email) return alert("Enter name and email");

      try {
        const res = await axios.post(customerApi, { name, email, phone });
        selectedCustomerId = res.data.id;
        closeModal("customerModal");
        document.getElementById("cashTotalDisplay").textContent =
          getCartTotal().toFixed(2);
        document.getElementById("paymentModal").style.display = "flex";
      } catch (err) {
        alert("Registration failed: " + err.message);
      }
    });

  document.getElementById("skipCustomerBtn").addEventListener("click", () => {
    selectedCustomerId = null;
    closeModal("customerModal");
    document.getElementById("cashTotalDisplay").textContent =
      getCartTotal().toFixed(2);
    document.getElementById("paymentModal").style.display = "flex";
  });

  // document.getElementById("checkoutBtn").addEventListener("click", () => {
  //  if (cartItems.length === 0) return alert("No items in cart.");
  //document.getElementById("cashTotalDisplay").textContent = getCartTotal().toFixed(2);
  //document.getElementById("paymentModal").style.display = "flex";
  // });

  // Payment method handlers
  document.querySelectorAll(".payment-method").forEach((btn) => {
    btn.addEventListener("click", () => {
      const method = btn.dataset.method;
      handlePaymentMethod(method);
    });
  });

  // Cash payment modal handlers
  document
    .getElementById("validateCashBtn")
    .addEventListener("click", validateCash);
  document
    .getElementById("confirmCashBtn")
    .addEventListener("click", confirmCash);
  document
    .getElementById("finalizePaymentBtn")
    .addEventListener("click", finalizePayment);
});

// Session functions
async function startNewSession() {
  const password = prompt("Enter session password:");
  if (password !== sessionPassword) {
    alert("❌ Incorrect password");
    return;
  }

  const startupCash = parseFloat(prompt("Enter startup cash amount:") || 0);
  const now = new Date();
  const session_date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const start_time = now.toTimeString().split(" ")[0];  // HH:MM:SS

  try {
    const res = await axios.post(sessionApi, {
      startup_cash: startupCash,
      status: "open",        
      session_date,
      start_time,
    });

    currentSessionId = res.data.id;
    sessionActive = true;

    document.getElementById("startDayBtn").disabled = true;
    document.getElementById("closeDayBtn").disabled = false;
    document.getElementById(
      "sessionStatus"
    ).textContent = `✅ New Session Started | Cash: Rs. ${startupCash.toFixed(
      2
    )}`;
    document.getElementById("sessionStatus").style.color = "#4caf50";
  } catch (error) {
    console.error("Error starting session:", error);
    alert("Failed to start new session");
  }
}


async function closeCurrentSession() {
  if (!confirm("Are you sure you want to close the current session?")) return;

  try {
    await axios.put(`${sessionApi}/${currentSessionId}`, {
      status: "closed",
      end_time: new Date().toISOString(),
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

function showPriceSelectionModal(
  productName,
  stockOptions,
  inventory,
  product
) {
  document.getElementById(
    "priceModalProductName"
  ).textContent = `Available prices for ${productName}`;
  const container = document.getElementById("priceOptions");
  container.innerHTML = "";

  stockOptions.forEach((option) => {
    //console.log("Stock Option:", option);
    const btn = document.createElement("button");
    const price = parseFloat(option.sell_price);
    btn.textContent = isNaN(price)
      ? `Invalid Price`
      : `Rs ${price.toFixed(2)} (Qty: ${option.quantity})`;

    btn.addEventListener("click", () => {
      const item = {
        id: inventory.id,
        name: product.name,
        price: parseFloat(option.sell_price),
        quantity: 1,
        total: parseFloat(option.sell_price),
        stockMovementId: option.id,
      };
      addToCart(item);
      closeModal("priceSelectModal");
    });
    container.appendChild(btn);
  });

  document.getElementById("priceSelectModal").style.display = "flex";
}

// Cart functions

function addToCart(item) {
  // Check if same inventory AND same stockMovementId already exists
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

//function addToCart(item) {
//const existing = cartItems.find((ci) => ci.id === item.id);
//if (existing) {
//existing.quantity += 1;
//existing.total = existing.quantity * existing.price;
// } else {
// cartItems.push({ ...item });
//  }
//  renderCart();
//}

function renderCart() {
  const cartList = document.getElementById("cartList");
  const totalDisplay = document.getElementById("totalAmount");
  cartList.innerHTML = "";
  let total = 0;

  cartItems.forEach((item, index) => {
    const div = document.createElement("div");
    div.classList.add("cart-item");
    div.innerHTML = `
      <div style="flex: 1;">
        <strong>${item.name}</strong><br/>
        <small>Rs ${item.price.toFixed(2)} each</small>
      </div>
      <div style="text-align: center;">
        <button onclick="changeQty(${index}, -1)">-</button>
        <span>${item.quantity}</span>
        <button onclick="changeQty(${index}, 1)">+</button>
      </div>
      <div>
        <input type="number" min="0" max="100" value="${item.discount || 0}" 
               onchange="setDiscount(${index}, this.value)" style="width: 50px;" />%
      </div>
      <div style="text-align: right;">
        Rs ${getItemTotal(item).toFixed(2)}<br/>
        <button onclick="removeItem(${index})">🗑</button>
      </div>
    `;
    cartList.appendChild(div);
    total += getItemTotal(item);
  });

  totalDisplay.textContent = total.toFixed(2);
}

function changeQty(index, delta) {
  cartItems[index].quantity += delta;
  if (cartItems[index].quantity <= 0) {
    cartItems.splice(index, 1);
  }
  renderCart();
}

function setDiscount(index, discount) {
  cartItems[index].discount = parseFloat(discount) || 0;
  renderCart();
}

function removeItem(index) {
  cartItems.splice(index, 1);
  renderCart();
}

function getItemTotal(item) {
  const base = item.quantity * item.price;
  const discount = (item.discount || 0) / 100;
  return base * (1 - discount);
}

function getCartTotal() {
  return cartItems.reduce((sum, item) => sum + getItemTotal(item), 0);
}

// Payment functions
function handlePaymentMethod(method) {
  closeModal("paymentModal");
  if (method === "cash") {
    document.getElementById("cashModal").style.display = "flex";
  } else {
    alert(`💡 ${method.toUpperCase()} payment method coming soon...`);
  }
}

function validateCash() {
  expectedCashIn = parseFloat(document.getElementById("cashInput").value);
  const physicalCash = getCashFromFields();

  if (expectedCashIn !== physicalCash) {
    alert("❌ Entered cash doesn't match physical cash.");
    return;
  }

  // Hide cash input and cash-in section
  document.querySelector(".cash-input-field").style.display = "none";
  document.querySelector(".cash-in").style.display = "none";

  // Show confirm and change-out section
  cashValidationPassed = true;
  const total = getCartTotal();
  changeAmount = expectedCashIn - total;

  document.getElementById("changeSection").style.display = "block";
  document.getElementById("finalCashOutSection").style.display = "block";
  document.getElementById("changeAmount").textContent = changeAmount.toFixed(2);
}

function confirmCash() {
  if (!cashValidationPassed) return;
  document.getElementById("finalCashOutSection").style.display = "block";
}

function finalizePayment() {
  const cashOut = getCashFromFields(true);
  if (cashOut !== changeAmount) {
    return alert("❌ Change cash doesn't match the expected change.");
  }

  alert("✅ Payment complete. Printing receipt...");
  closeModal("cashModal");
  resetCashModal();

  // Here you would typically:
  // 1. Create the order
  // 2. Create order items
  // 3. Create payment record
  // 4. Print receipt
  // 5. Clear cart
  createOrderAndPayment();
}

function getCashFromFields(isFinal = false) {
  const prefix = isFinal ? "changecash" : "cash";
  let total = 0;

  const denominations = [
    { id: "5000", value: 5000 },
    { id: "1000", value: 1000 },
    { id: "500", value: 500 },
    { id: "100", value: 100 },
    { id: "50", value: 50 },
    { id: "20", value: 20 },
    { id: "10", value: 10 },
    { id: "1", value: 1 },
    { id: "001", value: 0.01 },
  ];

  denominations.forEach((denom) => {
    const field = document.getElementById(`${prefix}${denom.id}`);
    const count = parseFloat(field?.value || 0);
    total += count * denom.value;
  });

  return parseFloat(total.toFixed(2));
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function resetCashModal() {
  document.getElementById("cashInput").value = "";
  document.getElementById("confirmCashBtn").style.display = "none";
  document.getElementById("changeSection").style.display = "none";
  document.getElementById("finalCashOutSection").style.display = "none";
  cashValidationPassed = false;

  [...document.querySelectorAll("input[type='number']")].forEach(
    (input) => (input.value = "")
  );
}

async function createOrderAndPayment(method = "cash", paidAmount = 0) {
  try {
    const now = new Date();

    // 1. Create order
    const orderRes = await axios.post(orderApi, {
      session_id: currentSessionId,
      order_date: now.toISOString().slice(0, 10),
      order_time: now.toTimeString().slice(0, 8),
      customer_id: selectedCustomerId,
      total: getCartTotal(),
    });

    const orderId = orderRes.data.id;

    // 2. Loop through cart items
    for (const item of cartItems) {
      // 2.1 Create order item
      await axios.post(orderItemApi, {
        order_id: orderId,
        inventory_id: item.id,
        stock_movement_id: item.stockMovementId || null,
        price: item.price,
        quantity: item.quantity,
        subtotal: getItemTotal(item),
      });

      // 2.2 Update stock_movement quantity
      if (item.stockMovementId) {
        const stockMovement = await axios.get(
          `${stockApi}/${item.stockMovementId}`
        );
        const currentQty = stockMovement.data.quantity;
        const newQty = currentQty - item.quantity;

        await axios.put(`${stockApi}/update-quantity/${item.stockMovementId}`, {
          quantity: newQty < 0 ? 0 : newQty,
        });
      }
    }

    // 3. Create payment
    await axios.post(paymentApi, {
      order_id: orderId,
      method,
      amount: paidAmount,
    });

    // 4. Show receipt and reset cart
    showReceipt(orderId);
    cartItems = [];
    renderCart();

   
    setTimeout(() => {
      location.reload();
    }, 5000); 
  } catch (err) {
    console.error("Error completing order:", err);
    alert("❌ Failed to complete order.");
  }
}

async function showReceipt(orderId) {
  const logoUrl = "images/bill-logo.jpg";
  const customer = selectedCustomerId
    ? `Customer ID: ${selectedCustomerId}`
    : "Guest";

  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString();

  const total = getCartTotal().toFixed(2);
  const paymentMethod = "Cash"; // You can make this dynamic if needed
  const orderNumber = String(orderId).padStart(5, "0");

  let customerCopy = `
    <div class="receipt-section">
      <div style="text-align:center">
        <img src="${logoUrl}" alt="Logo" style="max-height:80px"><br/>
        <h3>Kamari Clothing</h3>
        <p>${customer}</p>
        <p>Date: ${date} | Time: ${time}</p>
        <h4>Customer Copy</h4>
      </div>
      <hr/>
      <table style="width:100%; font-size: 14px;">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Sub</th></tr></thead>
        <tbody>
  `;

  cartItems.forEach((item) => {
    customerCopy += `<tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>${getItemTotal(item).toFixed(2)}</td>
    </tr>`;
  });

  customerCopy += `
        </tbody>
      </table>
      <hr/>
      <div style="text-align:right"><strong>Total: Rs ${total}</strong></div>
    </div>
  `;

  // Store Copy
  let storeCopy = `
    <div class="receipt-section" style="margin-top: 30px;">
      <div style="text-align:center">
        <h3>Kamari Clothing - Store Copy</h3>
        <p>Order #: ${orderNumber}</p>
        <p>Date: ${date} | Time: ${time}</p>
      </div>
      <hr/>
      <p><strong>Amount:</strong> Rs ${total}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod}</p>
    </div>
  `;

  // Combine both
  const fullHTML = `
    ${customerCopy}
    ${storeCopy}
    <div style="margin-top: 20px; text-align:center;">
      <button onclick="window.print()">🖨️ Print Receipt</button>
      <button onclick="closeModal('receiptModal')">Close</button>
    </div>
  `;

  document.getElementById("receiptContent").innerHTML = fullHTML;
  document.getElementById("receiptModal").style.display = "flex";
}

// Make functions available globally for HTML onclick handlers
window.changeQty = changeQty;
window.setDiscount = setDiscount;
window.removeItem = removeItem;

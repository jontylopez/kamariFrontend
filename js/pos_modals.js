// ✅ All modal handling functions are collected here

import {
  getSessionActive,
  getCurrentSessionId,
  getExchangeItems,
  removeExchangeItem,
  clearExchangeItems,
} from "./pos_state.js";
import { getCartTotal } from "./pos_cart.js";
import { getItemTotal } from "./pos_cart.js";
import { handleExchangeBarcodeScan } from "./pos_barcode.js";
import { finalizeExchangeReturn } from "./pos_trans.js";
import { resetPOSState } from "./pos_pay.js";

let cashTrType = null;

// --- OPEN MODALS ---
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  // 1. First make visible (but keep off-screen)
  modal.style.display = "flex";
  modal.style.opacity = "0";
  modal.style.transform = "translateY(10px)";

  // 2. Force synchronous layout calculation
  void modal.offsetHeight; // Trigger reflow

  // 3. Smooth transition to final position
  requestAnimationFrame(() => {
    modal.style.opacity = "1";
    modal.style.transform = "translateY(0)";
  });

  // 4. Handle focus properly
  setTimeout(() => {
    const inputs = modal.querySelectorAll("input");
    if (inputs.length > 0) {
      inputs[0].focus({ preventScroll: true });
    }
  }, 50);
}

export function openCashTransModal(type) {
  if (!getCurrentSessionId()) {
    alert("❌ Start a session before recording cash.");
    return;
  }
  cashTrType = type;
  document.getElementById("cashTrTitle").textContent =
    type === "in" ? "Cash In" : "Cash Out";
  document.getElementById("cashTrAmount").value = "";
  document.getElementById("cashTrReason").value = "";
  openModal("cashTrModal");
}

export function showPriceSelectionModal(productName, stockOptions, callback) {
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
      closeModal("priceSelectModal");
      callback(stock);
    };
    container.appendChild(btn);
  });

  openModal("priceSelectModal");
}

export function openExchangeModal() {
  if (!getSessionActive() || !getCurrentSessionId()) {
    return alert("❌ Start a session first.");
  }

  clearExchangeItems(); // ✅ reset shared exchange item state
  renderExchangeItems();
  openModal("exchangeModal");

  // Remove old listeners before attaching new ones (to prevent duplicates)
  const barcodeInput = document.getElementById("exchangeBarcodeInput");
  barcodeInput.removeEventListener("keypress", handleExchangeBarcodeScan); // prevent duplicates
  barcodeInput.addEventListener("keypress", handleExchangeBarcodeScan);
  barcodeInput.focus();

  const confirmBtn = document.getElementById("confirmExchangeBtn");
  confirmBtn.removeEventListener("click", finalizeExchangeReturn); // prevent duplicates
  confirmBtn.addEventListener("click", finalizeExchangeReturn);
}

export function renderExchangeItems() {
  const container = document.getElementById("exchangeReturnList");
  const totalEl = document.getElementById("exchangeReturnTotal");
  container.innerHTML = "";

  let total = 0;
  const exchangeItems = getExchangeItems();
  exchangeItems.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
        <div class="cart-details">
          <strong>${item.name}</strong>
          <small>Size: ${item.size}</small>
          <small>Color: ${item.color}</small>
        </div>
        <div class="cart-actions">
          <label>Qty:</label>
          <input type="number" value="${
            item.quantity
          }" min="1" onchange="window.updateExchangeQty(${index}, this.value)" />
          <div class="item-total">Rs ${subtotal.toLocaleString("en-LK", {
            minimumFractionDigits: 2,
          })}</div>
          <button onclick="window.removeExchangeItem(${index})">🗑</button>
        </div>
      `;
    container.appendChild(row);
  });

  totalEl.textContent = total.toFixed(2);
}

export function openCustomerModal() {
  openModal("customerModal");
}

// --- CLOSE MODALS ---
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

export function closeAllModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });
}

// --- PRINT ---
export function printReceipt(modalId) {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.remove("modal-printing");
  });

  document.getElementById(modalId)?.classList.add("modal-printing");

  window.print();

  setTimeout(() => {
    document.getElementById(modalId)?.classList.remove("modal-printing");
  }, 500);
}

window.updateExchangeQty = function (index, value) {
  const items = getExchangeItems();
  const qty = parseInt(value);
  if (!isNaN(qty) && qty > 0) {
    items[index].quantity = qty;
    renderExchangeItems();
  }
};

window.removeExchangeItem = function (index) {
  removeExchangeItem(index);
  renderExchangeItems();
};

export async function renderReceiptAndShopCopy(
  orderId,
  customerId,
  paymentMethod,
  cashInAmount = null,
  totalAmount = null,
  items = [],
  exchangeId = null,
  balance = null,
  payments = []
) {
  const date = new Date();
  const orderNo = String(orderId).padStart(5, "0");
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString();
  const total = totalAmount ?? getCartTotal();
  const customerName = customerId ? `#${customerId}` : "Guest";
  const billDiscount = parseFloat(
    document.getElementById("billDiscount")?.value || 0
  );

  // Calculate net amount (before discount)
  const netAmount = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const discountAmount = (netAmount * billDiscount) / 100;
  const grossAmount = netAmount - discountAmount;

  // === Customer Receipt Section ===
  document.getElementById("receiptOrderNumber").textContent = orderNo;
  document.getElementById("receiptCustomerId").textContent = customerName;
  document.getElementById("receiptDate").textContent = dateStr;
  document.getElementById("receiptTime").textContent = timeStr;
  document.getElementById("receiptPaymentMethod").textContent =
    paymentMethod.toUpperCase();

  // Update bill summary
  document.getElementById("receiptNetAmount").textContent =
    netAmount.toFixed(2);
  document.getElementById("receiptDiscountAmount").textContent =
    discountAmount.toFixed(2);
  document.getElementById("receiptTotalAmount").textContent =
    grossAmount.toFixed(2);

  // Line items
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

  // Exchange ID
  const exchangeInfoEl = document.getElementById("receiptExchangeInfo");
  exchangeInfoEl.innerHTML = exchangeId
    ? `<strong>Exchange ID:</strong> #${exchangeId}`
    : "";

  // Clean up old cash info
  const totalsEl = document.querySelector(".totals");
  totalsEl.querySelector(".cash-info")?.remove();

  // Cash Info (only for cash payments or multy with cash)
  if (
    (paymentMethod === "cash" || paymentMethod === "multy") &&
    cashInAmount !== null
  ) {
    const cashInfo = document.createElement("div");
    cashInfo.classList.add("cash-info");
    const balanceAmt = balance ?? 0;
    cashInfo.innerHTML = `
        <p><strong>Cash In:</strong> Rs ${cashInAmount.toFixed(2)}</p>
        <p><strong>Balance Given:</strong> Rs ${balanceAmt.toFixed(2)}</p>
      `;
    totalsEl.appendChild(cashInfo);
  }

  // === Shop Copy Section ===
  document.getElementById("shopCopyOrderId").textContent = orderNo;
  document.getElementById("shopCopyDate").textContent = dateStr;
  document.getElementById("shopCopyCustomer").textContent = customerName;
  document.getElementById("shopCopyMethod").textContent =
    paymentMethod.toUpperCase();
  document.getElementById("shopCopyTotal").textContent = total.toFixed(2);

  const shopWrap = document.querySelector(".copy-details");
  document.getElementById("shopCopyCashInWrap").style.display = "none";
  shopWrap.querySelector(".shop-balance-info")?.remove();
  shopWrap.querySelector(".shop-payment-breakdown")?.remove();

  // Show payment breakdown for multy payments
  if (paymentMethod === "multy" && payments && payments.length > 0) {
    const breakdownDiv = document.createElement("div");
    breakdownDiv.classList.add("shop-payment-breakdown");
    breakdownDiv.style.marginTop = "10px";
    breakdownDiv.style.paddingTop = "10px";
    breakdownDiv.style.borderTop = "1px solid #ccc";

    let breakdownHTML = "";
    payments.forEach((payment) => {
      const methodName =
        payment.method.charAt(0).toUpperCase() + payment.method.slice(1);
      breakdownHTML += `<p><strong>${methodName}:</strong> Rs ${parseFloat(
        payment.amount
      ).toFixed(2)}</p>`;
    });

    breakdownDiv.innerHTML = breakdownHTML;
    shopWrap.appendChild(breakdownDiv);
  }

  if (
    (paymentMethod === "cash" || paymentMethod === "multy") &&
    cashInAmount !== null
  ) {
    document.getElementById("shopCopyCashInWrap").style.display = "block";
    document.getElementById("shopCopyCashIn").textContent =
      cashInAmount.toFixed(2);

    const balText = document.createElement("p");
    balText.classList.add("shop-balance-info");
    balText.innerHTML = `<strong>Balance Given:</strong> Rs ${
      balance?.toFixed(2) || "0.00"
    }`;
    shopWrap.appendChild(balText);
  }

  // ✅ Show receipt modal
  document.getElementById("receiptModal").style.display = "flex";
}

window.closeReceiptAndReset = function () {
  closeModal("receiptModal");
  resetPOSState();
};

window.closeModal = closeModal;
window.openModal = openModal;
window.printReceipt = printReceipt;

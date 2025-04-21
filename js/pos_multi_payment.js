import { getCartTotal } from "./pos_cart.js";
import { closeModal } from "./pos_modals.js";

export async function validateMultiExchange(id) {
  try {
    const res = await axios.get(
      `http://localhost:3000/api/return/validate/${id}`
    );

    if (!res.data.valid) {
      alert(res.data.message || "Exchange ID is invalid or already used.");
      return null;
    }

    return res.data.total_price;
  } catch (err) {
    console.error("❌ Exchange validation failed:", err);
    alert("Failed to validate exchange. Try again.");
    return null;
  }
}
export async function handleExchangeIdInput() {
  const id = document.getElementById("multiExchangeId").value.trim();
  const cartTotal =
    parseFloat(document.getElementById("cartTotalLabel").textContent) || 0;

  if (!id) {
    document.getElementById("multiExchangeInfo").textContent = "";
    document.getElementById("multiBalanceDue").textContent =
      cartTotal.toFixed(2);
    return;
  }

  try {
    const res = await axios.get(
      `http://localhost:3000/api/return/validate/${id}`
    );

    if (!res.data.valid) {
      alert(res.data.message || "❌ Invalid or used Exchange ID.");
      document.getElementById("multiExchangeInfo").textContent = "";
      document.getElementById("multiBalanceDue").textContent =
        cartTotal.toFixed(2);
      return;
    }

    const exchangeAmount = parseFloat(res.data.total_price);
    document.getElementById(
      "multiExchangeInfo"
    ).textContent = `Rs ${exchangeAmount.toFixed(2)}`;

    const newBalance = cartTotal - exchangeAmount;
    document.getElementById("multiBalanceDue").textContent =
      newBalance.toFixed(2);
  } catch (err) {
    console.error("❌ Exchange validation error:", err);
    alert("Failed to validate Exchange ID. Try again.");
  }
}

function attachPaymentListeners() {
  // Recalculate total paid
  document.querySelectorAll(".pay-amount").forEach((input) => {
    input.addEventListener("input", liveCalculateBalance);
  });

  // Recalculate only balance preview
  document
    .getElementById("cashInValue")
    .addEventListener("input", updateCashPreview);
}
// 👉 This ONLY handles cashIn → balance preview
function updateCashPreview() {
  const cashIn = parseFloat(document.getElementById("cashInValue").value) || 0;
  const cashAmount =
    parseFloat(
      document.querySelector(".pay-amount[data-method='cash']").value
    ) || 0;
  const cashChange = Math.max(0, cashIn - cashAmount);

  document.getElementById("cashBalancePreview").textContent =
    cashChange.toFixed(2);
}
function initMultiPaymentModal(cartTotal) {
  // Set initial values
  document.querySelector(".pay-amount[data-method='cash']").value = cartTotal;
  document.querySelector(".pay-amount[data-method='card']").value = 0;
  document.querySelector(".pay-amount[data-method='voucher']").value = 0;
  document.getElementById("cashInValue").value = 0;
  document.getElementById("cashBalancePreview").textContent = "0.00";
  document.getElementById("multiBalanceDue").textContent = cartTotal.toFixed(2);

  // ✅ Ensure cash field is visible
  const cashField = document.querySelector(".pay-field[data-method='cash']");
  if (cashField) cashField.style.display = "block";

  // ✅ Focus on Cash In field
  setTimeout(() => {
    const cashInField = document.getElementById("cashInValue");
    if (cashInField) cashInField.focus();
  }, 50);

  attachPaymentListeners();
}

// === Modal Button Wiring ===
function openPaymentModal() {
  const cartTotal = getCartTotal();

  document.getElementById("cartTotalLabel").textContent = cartTotal.toFixed(2);
  document.getElementById("multiTotalDue").textContent = cartTotal.toFixed(2);

  initMultiPaymentModal(cartTotal);
  closeModal("customerModal");
  openModal("paymentModal");
  // document.getElementById("paymentModal").style.display = "block";
}

// === Toggle Field Logic ===
function togglePayField(method) {
  const field = document.querySelector(`.pay-field[data-method="${method}"]`);
  if (!field) return;
  field.style.display = field.style.display === "block" ? "none" : "block";
}
function liveCalculateBalance() {
  const cartTotal =
    parseFloat(document.getElementById("multiTotalDue").textContent) || 0;

  const cashAmount =
    parseFloat(
      document.querySelector(".pay-amount[data-method='cash']").value
    ) || 0;
  const cardAmount =
    parseFloat(
      document.querySelector(".pay-amount[data-method='card']").value
    ) || 0;
  const voucherAmount =
    parseFloat(
      document.querySelector(".pay-amount[data-method='voucher']").value
    ) || 0;

  const totalPaid = cashAmount + cardAmount + voucherAmount;
  const balanceDue = cartTotal - totalPaid;

  // ✅ Update values based on cart + entered amounts
  document.getElementById("multiEnteredTotal").textContent =
    totalPaid.toFixed(2);
  document.getElementById("multiBalanceDue").textContent =
    balanceDue.toFixed(2);
}
function resetPaymentModal() {
  document.querySelector(".pay-amount[data-method='cash']").value = "";
  document.querySelector(".pay-amount[data-method='card']").value = "0";
  document.querySelector(".pay-amount[data-method='voucher']").value = "0";
  document.getElementById("cashInValue").value = "";
  document.getElementById("cashBalancePreview").textContent = "0.00";
  document.getElementById("multiEnteredTotal").textContent = "0.00";

  // Reset exchange section
  document.getElementById("multiExchangeId").value = "";
  document.getElementById("multiExchangeInfo").textContent = "";
  document.getElementById("multiBalanceDue").textContent =
    document.getElementById("cartTotalLabel").textContent || "0.00";

  // Hide optional fields if shown
  const optionalFields = document.querySelectorAll(".pay-field");
  optionalFields.forEach((field) => {
    if (field.dataset.method !== "cash") {
      field.style.display = "none";
    }
  });
}

// === Export for other files
export {
  openPaymentModal,
  togglePayField,
  initMultiPaymentModal,
  resetPaymentModal,
};
// Make available globally if needed
window.openPaymentModal = openPaymentModal;
window.togglePayField = togglePayField;

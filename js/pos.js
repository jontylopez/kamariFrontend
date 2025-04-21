// pos.js

import { getCartTotal } from "./pos_cart.js";

import {
  checkActiveSession,
  startNewSession,
  closeCurrentSession,
  updateSessionCashStatus,
  startLiveClock,
} from "./pos_session.js";

import { handleBarcodeScan } from "./pos_barcode.js";

import { clearCart, updateOrderNumber } from "./pos_cart.js";
import { submitCashTransaction } from "./pos_trans.js";
import {
  openCustomerModal,
  openExchangeModal,
  openCashTransModal,
  //openPaymentModal
} from "./pos_modals.js";
import {
  openPaymentModal,
  handleExchangeIdInput,
  resetPaymentModal,
} from "./pos_multi_payment.js";
import { searchCustomer, registerCustomer } from "./pos_customer.js";
import { finalizePayment, getPaymentData } from "./pos_pay.js";

// === INIT APP ===
document.addEventListener("DOMContentLoaded", async () => {
  await updateOrderNumber();
  await checkActiveSession();
  await updateSessionCashStatus();
  startLiveClock();
  setInterval(updateSessionCashStatus, 30000);

  initSessionHandlers();
  initCartHandlers();
  initModalHandlers();
});

function initSessionHandlers() {
  document
    .getElementById("startDayBtn")
    ?.addEventListener("click", startNewSession);
  document
    .getElementById("closeDayBtn")
    ?.addEventListener("click", closeCurrentSession);
}

function initCartHandlers() {
  document
    .getElementById("barcodeInput")
    ?.addEventListener("keypress", handleBarcodeScan);
  document.getElementById("checkoutBtn")?.addEventListener("click", () => {
    if (getCartTotal() <= 0) {
      alert("🛒 Cart is empty. Please scan an item.");
      return;
    }
    openCustomerModal();
    updateOrderNumber();
  });

  document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
  document
    .getElementById("exchangeBtn")
    ?.addEventListener("click", openExchangeModal);
}
function initModalHandlers() {
  document
    .getElementById("cashInBtn")
    ?.addEventListener("click", () => openCashTransModal("in"));
  document
    .getElementById("cashOutBtn")
    ?.addEventListener("click", () => openCashTransModal("out"));
  document
    .getElementById("exchangeBtn")
    ?.addEventListener("click", openExchangeModal);
  document.getElementById("submitCashTrBtn")?.addEventListener("click", () => {
    const type = document
      .getElementById("cashTrTitle")
      .textContent.includes("In")
      ? "in"
      : "out";
    submitCashTransaction(type);
  });
  document
    .getElementById("skipCustomerBtn")
    ?.addEventListener("click", openPaymentModal);
  document
    .getElementById("searchCustomerBtn")
    ?.addEventListener("click", searchCustomer);
  document
    .getElementById("registerCustomerBtn")
    ?.addEventListener("click", registerCustomer);
  document
    .getElementById("finalizePayBtn")
    ?.addEventListener("click", finalizePayment);
  document
    .getElementById("exchangeValidation")
    ?.addEventListener("click", handleExchangeIdInput);
  document.getElementById("cancelPaymentBtn")?.addEventListener("click", () => {
    resetPaymentModal();
    closeModal("paymentModal");
  });
}

console.log("✅ POS Initialized");

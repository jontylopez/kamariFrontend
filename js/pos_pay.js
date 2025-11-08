import {
  getCartItems,
  getSelectedCustomerId,
  getCurrentSessionId,
  setSelectedCustomerId,
} from "./pos_state.js";
import { getItemTotal, updateOrderNumber } from "./pos_cart.js";
import { renderCart, getCartTotal } from "./pos_cart.js";
import { closeModal, renderReceiptAndShopCopy } from "./pos_modals.js";
import { recordCashTransaction } from "./pos_session.js";

const orderApi = "http://localhost:3000/api/pos-order";

export async function getPaymentData() {
  const cartTotal = getCartTotal();
  const exchangeId =
    document.getElementById("multiExchangeId")?.value.trim() || null;
  const exchangeText =
    document.getElementById("multiExchangeInfo")?.textContent || "";
  const exchangeAmount = exchangeText.includes("Rs")
    ? parseFloat(exchangeText.replace(/\D/g, "")) || 0
    : 0;

  const cashAmount = parseFloat(
    document.querySelector(".pay-amount[data-method='cash']")?.value || 0
  );
  const cashIn = parseFloat(document.getElementById("cashInValue")?.value || 0);
  const cardAmount = parseFloat(
    document.querySelector(".pay-amount[data-method='card']")?.value || 0
  );
  const voucherAmount = parseFloat(
    document.querySelector(".pay-amount[data-method='voucher']")?.value || 0
  );

  const payments = [];

  if (cashAmount > 0) {
    payments.push({
      method: "cash",
      amount: cashAmount,
      cashIn,
      change: Math.max(0, cashIn - cashAmount),
    });
  }
  if (cardAmount > 0) {
    payments.push({ method: "card", amount: cardAmount });
  }
  if (voucherAmount > 0) {
    payments.push({ method: "voucher", amount: voucherAmount });
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const diff = cartTotal - totalPaid;

  const paymentMethod = payments.length === 1 ? payments[0].method : "multy";

  return {
    cartTotal,
    exchangeId,
    exchangeAmount,
    payments,
    paymentMethod,
    totalPaid,
    diff,
    timestamp: new Date().toISOString(),
  };
}

export async function finalizePayment() {
  const paymentData = await getPaymentData();
  console.log("🔍 Received paymentData:", paymentData);

  const errorEl = document.getElementById("payment-error-message");

  // 💥 Basic Validation
  if (!paymentData || !Array.isArray(paymentData.payments)) {
    errorEl.textContent = "❌ Payment data is invalid!";
    return;
  }

  const { exchangeId, payments, totalPaid } = paymentData;
  const balanceDue = parseFloat(
    document.getElementById("multiBalanceDue")?.textContent || 0
  );
  const diff = Math.abs(balanceDue - totalPaid);

  // ✅ Skip diff validation if balanceDue is 0 or less
  if (balanceDue > 0 && diff > 0.05) {
    errorEl.textContent = "❌ Entered amounts do not match the total bill.";
    return;
  }
  try {
    const now = new Date();
    const sessionId = getCurrentSessionId();
    const customerId = getSelectedCustomerId();
    const cartItems = getCartItems();
    const billDiscount = parseFloat(
      document.getElementById("billDiscount")?.value || 0
    );

    const subtotal = cartItems.reduce(
      (sum, item) => sum + getItemTotal(item),
      0
    );
    const orderTotal = parseFloat(
      (subtotal * (1 - billDiscount / 100)).toFixed(2)
    );
    const paymentMethod = payments.length === 1 ? payments[0].method : "multy";

    // ✅ Send order + items (and exchange ID if exists)
    const orderPayload = {
      order: {
        session_id: sessionId,
        order_date: now.toISOString().split("T")[0],
        order_time: now.toTimeString().split(" ")[0],
        customer_id: customerId || null,
        discount: billDiscount,
        total: orderTotal,
        exchange_id: exchangeId || null,
      },
      items: cartItems.map((item) => ({
        inventory_id: item.id,
        stock_movement_id: item.stockMovementId || null,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount || 0,
        subtotal: getItemTotal(item),
      })),
      payments: payments.map((p) => ({
        method: p.method,
        amount: p.amount,
      })),
    };

    const orderRes = await axios.post(orderApi, orderPayload);
    const orderId = orderRes.data.id;

    const cashPayment = payments.find((p) => p.method === "cash");
    if (cashPayment) {
      const date = now.toISOString().split("T")[0];
      const time = now.toTimeString().split(" ")[0];

      await recordCashTransaction({
        session_id: sessionId,
        order_id: orderId,
        type: "in",
        reason: exchangeId ? "Cash - Exchange Payment" : "Cash Payment",
        amount: cashPayment.amount,
        date,
        time,
        recorded_by: "POS Operator",
      });
    }

    const cashIn = payments.find((p) => p.method === "cash")?.cashIn || null;
    const balance = payments.find((p) => p.method === "cash")?.change || null;

    // Generate receipt first
    renderReceiptAndShopCopy(
      orderId,
      customerId,
      paymentMethod,
      cashIn,
      orderTotal,
      [...cartItems],
      exchangeId,
      balance,
      payments // Pass payments array for breakdown display
    );

    // Then clear the cart and reset values
    renderCart([]); // clear cart
    document.getElementById("billDiscount").value = 0;
    closeModal("paymentModal");
    await updateOrderNumber();
    closeModal("customerModal");
  } catch (err) {
    console.error("❌ Finalization failed:", err);
    document.getElementById("payment-error-message").textContent =
      "❌ Payment failed. Try again.";
  }
}
function resetCustomerData() {
  setSelectedCustomerId(null);

  document.getElementById("customerPhone").value = "";
  document.getElementById("customerName").value = "";
  document.getElementById("customerEmail").value = "";

  const newFields = document.getElementById("newCustomerFields");
  if (newFields) {
    newFields.style.display = "none";
  }
}
export function resetPOSState() {
  renderCart([]);
  location.reload();
  resetCustomerData();
  const billDiscountInput = document.getElementById("billDiscount");
  if (billDiscountInput) billDiscountInput.value = 0;
  updateOrderNumber();
}

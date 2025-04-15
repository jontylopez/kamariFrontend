  
import { getCurrentSessionId } from './pos_state.js';
import { updateSessionCashStatus } from './pos_session.js';
import { getExchangeItems, clearExchangeItems } from './pos_state.js'

export async function submitCashTransaction(type) {
    const amount = parseFloat(document.getElementById("cashTrAmount").value);
    const reason = document.getElementById("cashTrReason").value;
  
    if (isNaN(amount) || amount <= 0) {
      alert("❌ Please enter a valid amount.");
      return;
    }
  
    if (!reason.trim()) {
      alert("❌ Please enter a reason for this transaction.");
      return;
    }
  
    const sessionId = getCurrentSessionId();
    if (!sessionId) {
      alert("❌ No active session found.");
      return;
    }
  
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
  
    const cashData = {
      session_id: sessionId,
      order_id: null,
      type,
      reason,
      amount,
      date,
      time,
      recorded_by: "POS Operator"
    };
  
    try {
      const response = await axios.post('http://localhost:3000/api/cash', cashData);
  
      if (response.status === 200 || response.status === 201) {
        alert(`✅ ${type === "in" ? "Cash In" : "Cash Out"} of Rs ${amount.toFixed(2)} recorded successfully.`);
        closeModal("cashTrModal");
        await updateSessionCashStatus();
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Error recording cash transaction:", error);
      alert("❌ Failed to record transaction. Please try again.");
    }
  }

  export async function finalizeExchangeReturn() {
    const exchangeItems = getExchangeItems();
  
    if (exchangeItems.length === 0) {
      return alert("🛒 No items scanned for exchange.");
    }
  
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0];
    const restock = document.getElementById("restockCheckbox").checked;
  
    try {
      const url = restock
        ? `http://localhost:3000/api/return/with-restock`
        : `http://localhost:3000/api/return/without-restock`;
  
      const payload = {
        session_id: getCurrentSessionId(),
        date,
        time,
        items: exchangeItems,
        processed_by: "POS Operator",
      };
  
      console.log("📦 Final Exchange Payload", payload);
  
      const res = await axios.post(url, payload);
      const returnId = res.data.id;
  
      alert("✅ Exchange processed successfully.");
      closeModal("exchangeModal");
      clearExchangeItems();
      await renderReturnReceipt(returnId);
  
    } catch (err) {
      console.error("❌ Failed to process exchange:", err);
      alert(err.response?.data?.error || "Failed to process return.");
    }
  }
  export async function renderReturnReceipt(returnId) {
    try {
      const res = await axios.get(`http://localhost:3000/api/return/${returnId}`);
      const returnData = res.data;
  
      const itemsRes = await axios.get(`http://localhost:3000/api/return/item/by-return/${returnId}`);
      const items = itemsRes.data;
  
      const dateStr = new Date(returnData.date).toLocaleDateString();
      const timeStr = returnData.time;
      const restockText = items.every((i) => i.restock) ? "Yes" : "No";
  
      const container = document.getElementById("returnReceiptModal");
      container.innerHTML = `
        <div class="receipt-container">
          <div class="receipt-copy">
            <h2>Return Receipt - Customer Copy</h2>
            <p><strong>Return ID:</strong> #${returnId}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            <p><strong>Restocked:</strong> ${restockText}</p>
            <hr>
            ${items.map(item => `
              <p>
                ${item.Inventory?.Product?.name || "Product"} (${item.Inventory?.b_code_id || ""})<br>
                Qty: ${item.quantity} | Price: Rs ${parseFloat(item.price).toFixed(2)}
              </p>`).join("")}
            <hr>
            <p><strong>Total:</strong> Rs ${parseFloat(returnData.total_price || 0).toFixed(2)}</p>
          </div>
  
          <hr class="divider">
  
          <div class="receipt-copy">
            <h2>Return Receipt - Shop Copy</h2>
            <p><strong>Return ID:</strong> #${returnId}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            <p><strong>Processed By:</strong> ${items[0]?.processed_by || "POS"}</p>
            <p><strong>Restocked:</strong> ${restockText}</p>
            <hr>
            ${items.map(item => `
              <p>
                ${item.Inventory?.b_code_id || item.inventory_id}<br>
                Qty: ${item.quantity} | Price: Rs ${parseFloat(item.price).toFixed(2)}
              </p>`).join("")}
            <hr>
            <p><strong>Total:</strong> Rs ${parseFloat(returnData.total_price || 0).toFixed(2)}</p>
          </div>
  
          <div class="receipt-actions">
            <button onclick="printReceipt('returnReceiptModal')">🖨️ Print</button>
            <button onclick="closeModal('returnReceiptModal')">Close</button>
          </div>
        </div>
      `;
  
      container.style.display = "flex";
    } catch (err) {
      console.error("❌ Failed to load return receipt:", err);
      alert("Could not load return receipt.");
    }
  }

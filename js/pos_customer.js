const customerApi = "http://localhost:3000/api/customer";
import { getSelectedCustomerId, setSelectedCustomerId } from './pos_state.js';
import { openPaymentModal } from './pos_multi_payment.js'; 



export async function searchCustomer() {
  const phone = document.getElementById("customerPhone").value.trim();
  if (!phone) return;

  try {
    const res = await axios.get(`${customerApi}/phone/${phone}`);

    if (res.data && res.data.id) {
      setSelectedCustomerId(res.data.id);
      openPaymentModal();
    } else {
      throw new Error("No customer ID returned");
    }

  } catch (err) {
    document.getElementById("newCustomerFields").style.display = "block";
  }
}

export async function registerCustomer() {
  const name = document.getElementById("customerName").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();

  if (!name || !phone) {
    return alert("❌ Name and phone number are required.");
  }

  try {
    const payload = {
      name,
      phone,
      ...(email && { email }),
    };

    const res = await axios.post(customerApi, payload);
    setSelectedCustomerId(res.data.id); // ✅ Correct setter
    openPaymentModal();
  } catch (err) {
    console.error("Customer registration error:", err);
    alert("❌ Failed to register customer.");
  }
}

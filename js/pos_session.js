import {
  getSessionActive,
  setSessionActive,
  getCurrentSessionId,
  setCurrentSessionId,
} from "./pos_state.js";

export const sessionApi = "http://localhost:3000/api/pos-session";
export const cashApi = "http://localhost:3000/api/cash";
export const paymentApi = "http://localhost:3000/api/pos-payment";

// ✅ SESSION CHECK
export async function checkActiveSession() {
  try {
    const res = await axios.get(`${sessionApi}/active`);
    const session = res.data;

    if (session.active) {
      setSessionActive(true);
      setCurrentSessionId(session.id);
    } else {
      setSessionActive(false);
      setCurrentSessionId(null);
    }
  } catch (err) {
    console.error("❌ Error checking session:", err);
    setSessionActive(false);
    setCurrentSessionId(null);
  }

  document.getElementById("startDayBtn").disabled = getSessionActive();
  document.getElementById("closeDayBtn").disabled = !getSessionActive();
  togglePOSAccess(getSessionActive());
}

// ✅ START NEW SESSION
export async function startNewSession() {
  const input = prompt("Enter opening cash:");
  if (input === null) return;

  const amount = parseFloat(input);
  if (isNaN(amount) || amount < 0) {
    alert("❌ Invalid opening cash amount.");
    return;
  }

  try {
    const now = new Date();
    const session_date = now.toISOString().split("T")[0];
    const start_time = now.toTimeString().split(" ")[0];

    const res = await axios.post(sessionApi, {
      startup_cash: amount,
      session_date,
      start_time,
      opened_by: "POS Operator",
    });

    setCurrentSessionId(res.data.id);

    await recordCashTransaction({
      session_id: res.data.id,
      type: "in",
      reason: "Day Start Cash",
      amount,
      date: session_date,
      time: start_time,
    });

    await updateSessionCashStatus();
    alert("✅ New session started.");
  } catch (err) {
    console.error("❌ Failed to start session:", err);
    alert(err.response?.data?.error || "Failed to start session.");
  }
}

// ✅ CLOSE SESSION
export async function closeCurrentSession() {
  if (!confirm("Are you sure you want to close the current session?")) return;

  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    alert("❌ No active session ID found.");
    return;
  }

  try {
    // ✅ Trigger CSV download using anchor link
    const downloadLink = document.createElement("a");
    downloadLink.href = `http://localhost:3000/api/pos-report/download/${sessionId}`;
    downloadLink.download = `POS_Report_${new Date().toLocaleDateString()}.csv`;
    downloadLink.click();

    // ✅ Now close session
    const now = new Date();
    const end_time = now.toTimeString().split(" ")[0];

    await axios.put(`${sessionApi}/close/${sessionId}`, {
      end_time,
      cash_in_drawer: 0,
      closed_by: "POS Operator",
    });

    setSessionActive(false);
    setCurrentSessionId(null);

    document.getElementById("startDayBtn").disabled = false;
    document.getElementById("closeDayBtn").disabled = true;
    document.getElementById("sessionStatus").textContent =
      "❌ No Active Session";
    document.getElementById("sessionStatus").style.color = "#f44336";

    alert("✅ Session closed.");
  } catch (err) {
    console.error("❌ Failed to close session:", err);
    alert(err.response?.data?.error || "Failed to close session.");
  }
}

// ✅ UPDATE CASH STATUS
export async function updateSessionCashStatus() {
  try {
    await checkActiveSession();

    if (!getSessionActive() || !getCurrentSessionId) {
      document.getElementById("sessionStatus").textContent =
        "❌ No Active Session";
      return;
    }

    const res = await axios.get(`${sessionApi}/active`);
    const session = res.data;

    const cashTrRes = await axios.get(`${cashApi}/session/${session.id}`);
    const cashTransactions = cashTrRes.data;

    const paymentRes = await axios.get(paymentApi);
    const sessionPayments = paymentRes.data.filter(
      (p) => p.method === "cash" && p.order && p.order.session_id === session.id
    );

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

    document.getElementById("sessionStatus").innerHTML = `
        ✅ Session Open | <strong>Date:</strong> ${sessionDate} |
        <strong>Time:</strong> <span id="liveClock">--:--:--</span> |
        <strong>Cash:</strong> Rs. ${cashInDrawer.toFixed(2)}    
      `;
  } catch (err) {
    console.error("Failed to update session cash status", err);
  }
}

// ✅ CLOCK & ACCESS
export function startLiveClock() {
  setInterval(() => {
    const now = new Date();
    const clockEl = document.getElementById("liveClock");
    if (clockEl) clockEl.textContent = now.toLocaleTimeString();
  }, 1000);
}

export function togglePOSAccess(enabled) {
  document.querySelectorAll("input, button").forEach((el) => {
    if (!el.classList.contains("always-enabled") && !el.closest("header")) {
      el.disabled = !enabled;
    }
  });
  document.getElementById("cashInBtn").disabled = !enabled;
  document.getElementById("cashOutBtn").disabled = !enabled;
}

// ✅ RECORD CASH MOVEMENT
export async function recordCashTransaction({
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
  } catch (err) {
    console.error("❌ Error logging cash transaction:", err);
  }
}

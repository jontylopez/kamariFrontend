const productApi = "http://localhost:3000/api/products";
const inventoryApi = "http://localhost:3000/api/inventory";
const stockApi = "http://localhost:3000/api/stock-movements";
const supplierApi = "http://localhost:3000/api/suppliers";
const supBrandApi = "http://localhost:3000/api/sup-brands";
const brandApi = "http://localhost:3000/api/brands";

let allSupBrands = [];
let allProducts = [];
let allInventory = [];
let allStockMovements = [];
let allSuppliers = [];
let allBrands = [];


document.addEventListener("DOMContentLoaded", async () => {
  await loadSuppliers(); 
  await loadBrands(); 
  await loadSupBrands(); 

  await loadProducts();
  await loadInventory();
  await loadStockMovements();

  document
    .getElementById("inventoryForm")
    .addEventListener("submit", handleSubmit);

  document
    .getElementById("inventorySearch")
    .addEventListener("input", filterInventory);

  document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("barcodeDownloadModal").style.display = "none";
  });
});
async function loadSupBrands() {
  const res = await axios.get(supBrandApi);
  allSupBrands = res.data;

  const select = document.getElementById("inventoryCombo");
  select.innerHTML = `<option value="">Select Supplier-Brand Combo</option>`;

  allSupBrands.forEach((sb) => {
    const supplier = allSuppliers.find((s) => s.id === sb.sup_id);
    const brand = allBrands.find((b) => b.id === sb.brand_id);

    const option = document.createElement("option");
    option.value = sb.id;
    option.textContent = `${supplier?.name || "Supplier"} | ${brand?.name || "Brand"
      }`;
    select.appendChild(option);
  });
}


async function loadProducts() {
  try {
    const res = await axios.get(productApi);
    allProducts = res.data;

    const select = document.getElementById("inventoryProduct");
    select.innerHTML = `<option value="">Select Product</option>`; 

    allProducts.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id; 
      option.textContent = `${p.name} (${p.gender} - ${p.type})`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

// Load suppliers
async function loadSuppliers() {
  const res = await axios.get(supplierApi);
  allSuppliers = res.data;
}
async function loadBrands() {
  const res = await axios.get(brandApi);
  allBrands = res.data;
}
// Load stock movements to use for latest price
async function loadStockMovements() {
  const res = await axios.get(stockApi);
  allStockMovements = res.data;
  renderInventoryTable(allInventory);
}

// Load inventory into table
async function loadInventory() {
  const res = await axios.get(inventoryApi);
  allInventory = res.data;
  renderInventoryTable(res.data);
}

function renderInventoryTable(data) {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  data.forEach((inv) => {
    const product = allProducts.find((p) => p.id === inv.product_id);
    const supBr = allSupBrands.find((sb) => sb.id === inv.sup_br_id);
    const supplier = allSuppliers.find((s) => s.id === supBr?.sup_id);
    const brand = allBrands.find((b) => b.id === supBr?.brand_id);
    const sellPrice = getLatestSellPrice(inv.id);
    const quantity = getTotalStockQuantity(inv.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inv.name}</td>
      <td>${product?.name || "N/A"}</td>
      <td>${supplier?.name || "Supplier"}</td>
      <td>${brand?.name || "Brand"}</td>
      <td>${inv.size}</td>
      <td>${inv.color}</td>
      <td>${inv.description || "-"}</td>
<td>
          ${inv.b_code_id}
<button onclick="openDownloadModal(&quot;${inv.b_code_id}&quot;, &quot;${inv.name
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")}&quot;, &quot;${sellPrice}&quot;, &quot;${inv.size
      }&quot;)">Print</button>


        </td>
      <td>${quantity}</td>
      <td>${sellPrice}</td>
      <td>
        <button class="restock" onclick="openRestockModal(${inv.id})">🔄</button>
        <button class="edit" onclick="loadInventoryForEdit(${inv.id})">✏️</button>
        <button class="delete" onclick="deleteInventory(${inv.id})">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterInventory() {
  const query = document.getElementById("inventorySearch").value.toLowerCase();

  const filtered = allInventory.filter((inv) => {
    const product = allProducts.find((p) => p.id === inv.product_id);
    const supBr = allSupBrands.find((sb) => sb.id === inv.sup_br_id);
    const supplier = allSuppliers.find((s) => s.id === supBr?.sup_id);
    const brand = allBrands.find((b) => b.id === supBr?.brand_id);
    const sellPrice = getLatestSellPrice(inv.id);
    const quantity = getTotalStockQuantity(inv.id);

    return [
      inv.name,
      inv.b_code_id,
      inv.color,
      inv.size,
      inv.description,
      product?.name,
      supplier?.name,
      brand?.name,
      sellPrice,
      quantity,
    ]
      .filter(Boolean)
      .some((val) => val.toString().toLowerCase().includes(query));
  });

  renderInventoryTable(filtered);
}

function getLatestSellPrice(inventory_id) {
  const entries = allStockMovements
    .filter((entry) => entry.inventory_id === inventory_id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return entries.length ? entries[0].sell_price : "-";
}
function getTotalStockQuantity(inventory_id) {
  const relevant = allStockMovements.filter(
    (entry) => entry.inventory_id === inventory_id
  );
  return relevant.reduce((sum, s) => sum + s.quantity, 0);
}

function showPriceSelectionModal(list, callback) {
  const modal = document.getElementById("priceSelectModal");
  const priceContainer = document.getElementById("priceOptions");
  priceContainer.innerHTML = "";

  // Detect item type (number or object)
  const isStockObject = typeof list[0] === "object" && list[0] !== null;

  list.forEach((item) => {
    const btn = document.createElement("button");

    if (isStockObject) {
      btn.textContent = `Buy: Rs.${parseFloat(item.buy_price).toFixed(2)}, Sell: Rs.${parseFloat(item.sell_price).toFixed(2)}, Qty: ${item.quantity}`;
      btn.onclick = () => {
        modal.style.display = "none";
        callback(item);
      };
    } else {
      btn.textContent = `Rs. ${parseFloat(item).toFixed(2)}`;
      btn.onclick = () => {
        modal.style.display = "none";
        callback(item);
      };
    }

    priceContainer.appendChild(btn);
  });

  modal.style.display = "flex";
}


function showBarcodeLabel(barcode, inventoryName, price, size) {
  document.getElementById("barcodeDownloadModal").style.display = "flex";

  // ✅ Update fields
  document.getElementById("labelProductName").textContent = inventoryName;
  document.getElementById("labelSizeText").textContent = `Size : ${size}`;
  document.getElementById("labelPrice").textContent = `Rs : ${parseFloat(
    price
  ).toFixed(2)}`;
  document.getElementById("labelCode").textContent = barcode;

  document.getElementById(
    "barcodePreviewImg"
  ).src = `http://localhost:3000/api/barcode/${barcode}`;
  document.getElementById("labelContainer").dataset.barcode = barcode;

  updateLabelSize();
}

async function handleSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("inventoryName").value.trim();
  const product_id = parseInt(document.getElementById("inventoryProduct").value);
  const product = allProducts.find((p) => p.id === product_id);
  const { gender, type } = product;

  const sup_br_id = parseInt(document.getElementById("inventoryCombo").value);
  const size = document.getElementById("inventorySize").value.trim();
  const color = document.getElementById("inventoryColor").value.trim();
  const description = document.getElementById("inventoryDesc").value.trim();
  const quantity = parseInt(document.getElementById("inventoryQuantity").value);
  const buy_price = parseFloat(document.getElementById("inventoryBuyPrice").value);
  const sell_price = parseFloat(document.getElementById("inventorySellPrice").value);
  const message = document.getElementById("formMessage");

  // ✅ Duplicate Check
  const isDuplicate = allInventory.some((inv) =>
    inv.name === name &&
    inv.product_id === product_id &&
    inv.sup_br_id === sup_br_id &&
    inv.size === size &&
    inv.color.toLowerCase() === color.toLowerCase() &&
    (inv.description || "").toLowerCase() === description.toLowerCase()
  );

  if (isDuplicate) {
    message.textContent = "❌ This inventory item already exists.";
    return;
  }
  try {
    const genderCode =
      gender === "female" ? "W" : gender === "male" ? "M" : "U";
    const typeMap = {
      UpperBody: "UP",
      LowerBody: "LO",
      FullBody: "FU",
      UnderGarment: "UN",
      Article: "AR",
    };
    const prefix = `${genderCode}${typeMap[type]}`;

    const invRes = await axios.get(inventoryApi);
    const count = invRes.data.filter((i) =>
      i.b_code_id.startsWith(prefix)
    ).length;
    const padded = String(count + 1).padStart(5, "0");
    const b_code_id = `${prefix}${padded}`;

    const invResPost = await axios.post(inventoryApi, {
      name,
      product_id,
      sup_br_id,
      size,
      color,
      description,
      b_code_id,
    });
    const inventory_id = invResPost.data.id;

    const existingStockRes = await axios.get(stockApi);
    const matching = existingStockRes.data.find(
      (sm) =>
        sm.inventory_id === inventory_id &&
        parseFloat(sm.buy_price) === buy_price &&
        parseFloat(sm.sell_price) === sell_price
    );

    if (matching) {
      await axios.put(`${stockApi}/${matching.id}`, {
        quantity: matching.quantity + quantity,
      });
    } else {
      await axios.post(stockApi, {
        inventory_id,
        quantity,
        buy_price,
        sell_price,
      });
    }

    message.textContent = `✅ Inventory added with Barcode: ${b_code_id}`;
    loadInventory();
    loadStockMovements();
  } catch (err) {
    console.error(err);
    message.textContent = `❌ Error: ${err.response?.data?.error || err.message
      }`;
  }
}

function openRestockModal(invId) {
  const inv = allInventory.find(i => i.id === invId);
  if (!inv) return alert("Inventory item not found.");

  const relevantStocks = allStockMovements.filter(s => s.inventory_id === invId);

  const loadRestockForm = (stock) => {
    const existing = document.getElementById("restockModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "restockModal";

    modal.innerHTML = `
      <div class="modal-content restock-modal">
        <h2>Restock: ${inv.name}</h2>

        <label>Name:</label>
        <input type="text" value="${inv.name}" readonly />

        <label>Size:</label>
        <input type="text" value="${inv.size}" readonly />

        <label>Barcode ID:</label>
        <input type="text" value="${inv.b_code_id}" readonly />

        <label>Buy Price:</label>
        <input type="number" id="restockBuyPrice" step="0.01" value="${stock?.buy_price || ''}" required />

        <label>Sell Price:</label>
        <input type="number" id="restockSellPrice" step="0.01" value="${stock?.sell_price || ''}" required />

        <label>Quantity:</label>
        <input type="number" id="restockQty" required />

        <div class="modal-actions">
          <button class="confirm-btn" onclick="submitRestock(${inv.id})">Restock</button>
          <button class="cancel-btn" onclick="closeRestockModal()">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = "flex";
  };

  if (relevantStocks.length === 1) {
    loadRestockForm(relevantStocks[0]); 
  } else if (relevantStocks.length > 1) {
    showPriceSelectionModal(relevantStocks, (selected) => {
      loadRestockForm(selected); 
    });
  } else {
    loadRestockForm(); 
  }
}

function closeRestockModal() {
  const modal = document.getElementById("restockModal");
  if (modal) modal.remove();
}


async function submitRestock(invId) {
  const buy_price = parseFloat(document.getElementById("restockBuyPrice").value);
  const sell_price = parseFloat(document.getElementById("restockSellPrice").value);
  const quantity = parseInt(document.getElementById("restockQty").value);

  try {
    const existing = allStockMovements.find(
      (s) =>
        s.inventory_id === invId &&
        parseFloat(s.buy_price) === buy_price &&
        parseFloat(s.sell_price) === sell_price
    );

    if (existing) {
      await axios.put(`${stockApi}/${existing.id}`, {
        quantity: existing.quantity + quantity
      });
    } else {
      await axios.post(stockApi, { inventory_id: invId, buy_price, sell_price, quantity });
    }

    closeRestockModal(); 
    await loadStockMovements();
    await loadInventory();
    alert("✅ Restock successful");
  } catch (err) {
    console.error("Restock error:", err);
    alert("❌ Restock failed. Please try again.");
  }
}


function loadInventoryForEdit(id) {
  const inv = allInventory.find((i) => i.id === id);
  const relevantStocks = allStockMovements.filter((s) => s.inventory_id === id);

  // Fill inventory fields
  document.getElementById("inventoryName").value = inv.name;
  document.getElementById("inventoryProduct").value = inv.product_id;
  document.getElementById("inventoryCombo").value = inv.sup_br_id;
  document.getElementById("inventorySize").value = inv.size;
  document.getElementById("inventoryColor").value = inv.color;
  document.getElementById("inventoryDesc").value = inv.description || "";

  const qtyField = document.getElementById("inventoryQuantity");
  const buyField = document.getElementById("inventoryBuyPrice");
  const sellField = document.getElementById("inventorySellPrice");

  if (relevantStocks.length === 1) {
    const stock = relevantStocks[0];
    qtyField.value = stock.quantity;
    buyField.value = stock.buy_price;
    sellField.value = stock.sell_price;
    qtyField.disabled = false;
    buyField.disabled = false;
    sellField.disabled = false;

    // Attach to update
    prepareUpdateButton(inv.id, stock.id);
  } else {
    // Multiple stock options → prompt selection
    showPriceSelectionModal(relevantStocks, (chosenStock) => {
      qtyField.value = chosenStock.quantity;
      buyField.value = chosenStock.buy_price;
      sellField.value = chosenStock.sell_price;
      qtyField.disabled = false;
      buyField.disabled = false;
      sellField.disabled = false;

      // Attach to update
      prepareUpdateButton(inv.id, chosenStock.id);
    });
  }

  // Hide original button
  document.querySelector("button[type='submit']").style.display = "none";
}

function prepareUpdateButton(inventory_id, stock_movement_id) {
  let updateBtn = document.getElementById("updateInventoryBtn");
  if (!updateBtn) {
    updateBtn = document.createElement("button");
    updateBtn.id = "updateInventoryBtn";
    updateBtn.textContent = "Update Inventory";
    updateBtn.type = "button";
    document.getElementById("inventoryForm").appendChild(updateBtn);
  }
  updateBtn.style.display = "inline-block";
  updateBtn.onclick = () => updateInventoryWithStock(inventory_id, stock_movement_id);
}

async function updateInventoryWithStock(inventory_id, stock_movement_id) {
  try {
    const name = document.getElementById("inventoryName").value.trim();
    const product_id = parseInt(document.getElementById("inventoryProduct").value);
    const sup_br_id = parseInt(document.getElementById("inventoryCombo").value);
    const size = document.getElementById("inventorySize").value.trim();
    const color = document.getElementById("inventoryColor").value.trim();
    const description = document.getElementById("inventoryDesc").value.trim();

    const quantity = parseInt(document.getElementById("inventoryQuantity").value);
    const buy_price = parseFloat(document.getElementById("inventoryBuyPrice").value);
    const sell_price = parseFloat(document.getElementById("inventorySellPrice").value);

    // Update inventory
    await axios.put(`${inventoryApi}/${inventory_id}`, {
      name, product_id, sup_br_id, size, color, description
    });

    // Update selected stock_movement
    await axios.put(`${stockApi}/${stock_movement_id}`, {
      quantity, buy_price, sell_price
    });

    alert("Inventory and price updated.");
    document.getElementById("inventoryForm").reset();
    document.querySelector("button[type='submit']").style.display = "inline-block";
    document.getElementById("updateInventoryBtn").remove();

    loadInventory();
    loadStockMovements();
  } catch (err) {
    console.error("Update error:", err);
    alert("Failed to update.");
  }
}

async function deleteInventory(id) {
  const stocks = allStockMovements.filter((s) => s.inventory_id === id);

  // No stock
  if (stocks.length === 0) {
    if (!confirm("Delete inventory item without stock?")) return;
    await axios.delete(`${inventoryApi}/${id}`);
    await loadInventory();
    alert("Inventory deleted successfully.");
    return;
  }

  // One stock entry
  if (stocks.length === 1) {
    const confirmDelete = confirm("Delete inventory and its stock entry?");
    if (!confirmDelete) return;

    try {
      const stock_movement_id = stocks[0]?.id;
      if (stock_movement_id) await axios.delete(`${stockApi}/${stock_movement_id}`);
      await axios.delete(`${inventoryApi}/${id}`);

      await loadStockMovements();
      await loadInventory();
      alert("Inventory and stock deleted.");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete.");
    }
    return;
  }

  // Multiple stock entries
  showPriceSelectionModal(stocks, async (selectedStock) => {
    const confirmDelete = confirm(
      `Delete selected stock (Buy: Rs.${selectedStock.buy_price}, Sell: Rs.${selectedStock.sell_price}) only?\n\nTo delete inventory and all stock, do it manually.`
    );
    if (!confirmDelete) return;

    try {
      if (selectedStock?.id) {
        await axios.delete(`${stockApi}/${selectedStock.id}`);
        await loadStockMovements();
        await loadInventory();
        alert("Stock entry deleted.");
      } else {
        console.warn("Invalid stock ID selected.");
      }
    } catch (err) {
      console.error("Stock delete error:", err);
      alert("Failed to delete stock entry.");
    }
  });
}


function openDownloadModal(barcode, inventoryName, defaultPrice, size) {
  const inventory = allInventory.find((inv) => inv.b_code_id === barcode);
  const matchingPrices = allStockMovements
    .filter((s) => s.inventory_id === inventory.id && s.quantity > 0)
    .map((s) => s.sell_price);

  const uniquePrices = [...new Set(matchingPrices.map((p) => parseFloat(p)))];

  const safeName = inventoryName.replace(/'/g, "’");

  if (uniquePrices.length > 1) {
    showPriceSelectionModal(uniquePrices, (selectedPrice) => {
      showBarcodeLabel(barcode, safeName, selectedPrice, size);
    });
  } else {
    showBarcodeLabel(barcode, safeName, defaultPrice, size);
  }
}


function updateLabelSize() {
  const width = parseFloat(document.getElementById("labelWidth").value);
  const height = parseFloat(document.getElementById("labelHeight").value);
  const dpi = 3.7795; // mm to px

  const container = document.getElementById("labelContainer");
  container.style.width = `${width * dpi}px`;
  container.style.height = `${height * dpi}px`;
}

function fetchBarcodeImage(barcode) {
  document.getElementById(
    "barcodePreviewImg"
  ).src = `http://localhost:3000/api/barcode/${barcode}`;
}

function closeDownloadModal() {
  document.getElementById("barcodeDownloadModal").style.display = "none";
}

function closeDownloadModal() {
  document.getElementById("barcodeDownloadModal").style.display = "none";
}

function downloadBarcodeAsImage() {
  const img = document.getElementById("barcodePreviewImg");
  const barcode =
    document.getElementById("labelContainer").dataset.barcode || "barcode";

  if (!img.complete) {
    img.onload = () => downloadBarcodeAsImage(); 
    return;
  }

  html2canvas(document.getElementById("labelContainer"), {
    useCORS: true,
    scale: 3, 
  }).then((canvas) => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${barcode}.png`;
    link.click();
  });
}

function downloadBarcodeAsPDF() {
  const img = document.getElementById("barcodePreviewImg");
  const barcode =
    document.getElementById("labelContainer").dataset.barcode || "barcode";

  if (!img.complete) {
    img.onload = () => downloadBarcodeAsPDF(); 
    return;
  }

  const labelContainer = document.getElementById("labelContainer");

  html2canvas(labelContainer, {
    useCORS: true,
    scale: 3,
  }).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");

    const labelWidth = parseFloat(document.getElementById("labelWidth").value);
    const labelHeight = parseFloat(
      document.getElementById("labelHeight").value
    );

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: labelWidth > labelHeight ? "landscape" : "portrait",
      unit: "mm",
      format: [labelWidth, labelHeight],
    });

    pdf.addImage(imgData, "PNG", 0, 0, labelWidth, labelHeight);
    pdf.save(`${barcode}.pdf`);
  });
}

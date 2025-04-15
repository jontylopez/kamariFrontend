const productApi = "http://localhost:3000/api/products";
const inventoryApi = "http://localhost:3000/api/inventory";
const stockApi = "http://localhost:3000/api/stock-movements";
const supplierApi = "http://localhost:3000/api/suppliers";
const supBrandApi = "http://localhost:3000/api/sup-brands";
const brandApi = "http://localhost:3000/api/brands";

let allSupBrands = [];
let allProducts = [];
let allInventory = [];
let allSuppliers = [];
let allBrands = [];


document.addEventListener("DOMContentLoaded", async () => {
  await loadSuppliers(); 
  await loadBrands(); 
  await loadSupBrands(); 

  await loadProducts();
  await loadInventory();

  document.getElementById("inventoryForm").addEventListener("submit", handleSubmit);
  setupInventorySearch();

  document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("barcodeDownloadModal").style.display = "none";
  });

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

// Load inventory into table now Function from backend only show the lates 20
async function loadInventory() {
  try {
    const res = await axios.get(`${inventoryApi}/latest`);
    allInventory = res.data;
    renderInventoryTable(allInventory);
  } catch (err) {
    console.error("Failed to load inventory:", err);
  }
}


function renderInventoryTable(data) {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  data.forEach((inv) => {
    const product = inv.Product;
    const supBr = inv.SupBrand;
    const supplier = supBr?.Supplier;
    const brand = supBr?.Brand;
    const sellPrice = inv.latestSellPrice || "-";
    const quantity = inv.totalQuantity || 0;

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
        <button onclick="openDownloadModal(&quot;${inv.b_code_id}&quot;, &quot;${inv.name.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}&quot;, &quot;${sellPrice}&quot;, &quot;${inv.size}&quot;)">Print</button>
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
function setupInventorySearch() {
  const searchInput = document.getElementById("inventorySearch");
  let searchTimeout;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout); // 🔁 Reset on every keystroke

    searchTimeout = setTimeout(async () => {
      const query = searchInput.value.trim();

      if (query) {
        try {
          const res = await axios.get(`${inventoryApi}/search?query=${encodeURIComponent(query)}`);
          allInventory = res.data;
          renderInventoryTable(allInventory);
        } catch (err) {
          console.error("Live search failed:", err);
        }
      } else {
        // If search box is cleared, load default inventory
        loadInventory();
      }
    }, 300); // 🕒 300ms debounce
  });
}

async function searchInventoryIfQueryExists() {
  const query = document.getElementById("inventorySearch").value.trim();
  if (query) {
    try {
      const res = await axios.get(`${inventoryApi}/search?query=${encodeURIComponent(query)}`);
      allInventory = res.data;
      renderInventoryTable(allInventory);
    } catch (err) {
      console.error("Search failed:", err);
    }
  } else {
    await loadInventory();
  }
}


// function setupInventorySearch() {
//   const searchInput = document.getElementById("inventorySearch");
//   searchInput.addEventListener("keydown", async (e) => {
//     if (e.key === "Enter") {
//       const query = searchInput.value.trim();
//       if (!query) return loadInventory(); // If empty, load default

//       try {
//         const res = await axios.get(`${inventoryApi}/search?query=${encodeURIComponent(query)}`);
//         allInventory = res.data;
//         renderInventoryTable(allInventory);
//       } catch (err) {
//         console.error("Search failed:", err);
//       }
//     }
//   });
// }

async function getLatestSellPrice(inventory_id) {
  const res = await axios.get(`${stockApi}/by-inventory/${inventory_id}`);
  const sorted = res.data.sort((a, b) => new Date(b.date) - new Date(a.date));
  return sorted.length ? sorted[0].sell_price : "-";
}


async function getTotalStockQuantity(inventory_id) {
  const res = await axios.get(`${stockApi}/by-inventory/${inventory_id}`);
  return res.data.reduce((sum, s) => sum + s.quantity, 0);
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
// Modified now happening in backend
async function handleSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("inventoryName").value.trim();
  const product_id = parseInt(document.getElementById("inventoryProduct").value);
  const sup_br_id = parseInt(document.getElementById("inventoryCombo").value);
  const size = document.getElementById("inventorySize").value.trim();
  const color = document.getElementById("inventoryColor").value.trim();
  const description = document.getElementById("inventoryDesc").value.trim();
  const quantity = parseInt(document.getElementById("inventoryQuantity").value);
  const buy_price = parseFloat(document.getElementById("inventoryBuyPrice").value);
  const sell_price = parseFloat(document.getElementById("inventorySellPrice").value);
  const message = document.getElementById("formMessage");
  console.log('Sending to backend:', {
    name, product_id, sup_br_id, size, color, description
  });
  
  try {
    // 🔥 NEW barcode-generating API call
    const invRes = await axios.post(`${inventoryApi}/with-barcode`, {
      name,
      product_id,
      sup_br_id,
      size,
      color,
      description
    });

    const inventory_id = invRes.data.id;
    const b_code_id = invRes.data.b_code_id;

    // 🔁 Check if stock entry exists
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
  } catch (err) {
    console.error(err);
    message.textContent =
      `❌ ${err.response?.data?.error || 'Something went wrong. Please try again.'}`;
  }
}


async function openRestockModal(invId) {
  const inv = allInventory.find(i => i.id === invId);
  if (!inv) return alert("Inventory item not found.");

  const { data: relevantStocks } = await axios.get(`${stockApi}/by-inventory/${invId}`);

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
    // 🔁 Load stock movements for this inventory only
    const { data: relevantStocks } = await axios.get(`${stockApi}/by-inventory/${invId}`);

    // 🔍 Find matching price entry
    const existing = relevantStocks.find(
      (s) =>
        parseFloat(s.buy_price) === buy_price &&
        parseFloat(s.sell_price) === sell_price
    );

    if (existing) {
      // Update quantity
      await axios.put(`${stockApi}/${existing.id}`, {
        quantity: existing.quantity + quantity
      });
    } else {
      // Create new stock movement
      await axios.post(stockApi, {
        inventory_id: invId,
        quantity,
        buy_price,
        sell_price
      });
    }

    closeRestockModal();
    await searchInventoryIfQueryExists();

   // await loadInventory();
    alert("✅ Restock successful");
  } catch (err) {
    console.error("Restock error:", err);
    alert("❌ Restock failed. Please try again.");
  }
}


async function loadInventoryForEdit(id) {
  const inv = allInventory.find((i) => i.id === id);
  const { data: relevantStocks } = await axios.get(`${stockApi}/by-inventory/${id}`);

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

    // ✅ Update inventory data
    await axios.put(`${inventoryApi}/${inventory_id}`, {
      name, product_id, sup_br_id, size, color, description
    });

    // ✅ Update related stock
    await axios.put(`${stockApi}/${stock_movement_id}`, {
      quantity, buy_price, sell_price
    });

    // ✅ Clear form, reset buttons, reload
    document.getElementById("inventoryForm").reset();
    document.querySelector("button[type='submit']").style.display = "inline-block";
    const updateBtn = document.getElementById("updateInventoryBtn");
    if (updateBtn) updateBtn.remove();

    //await loadInventory();
    await searchInventoryIfQueryExists();


    alert("✅ Inventory updated successfully.");
  } catch (err) {
    console.error("Update error:", err);
    alert("❌ Failed to update.");
  }
}


async function deleteInventory(id) {
  const { data: stocks } = await axios.get(`${stockApi}/by-inventory/${id}`);

  // No stock
  if (stocks.length === 0) {
    if (!confirm("Delete inventory item without stock?")) return;
    await axios.delete(`${inventoryApi}/${id}`);
    await searchInventoryIfQueryExists();

    // await loadInventory();
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

     await searchInventoryIfQueryExists();
     // await loadInventory();
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
        await searchInventoryIfQueryExists();
//        await loadInventory();
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


async function openDownloadModal(barcode, inventoryName, defaultPrice, size) {
  const inventory = allInventory.find((inv) => inv.b_code_id === barcode);

  const { data: stockList } = await axios.get(`${stockApi}/by-inventory/${inventory.id}`);
const matchingPrices = stockList
  .filter((s) => s.quantity > 0)
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

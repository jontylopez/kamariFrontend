const productApi = "http://localhost:3000/api/products";
const inventoryApi = "http://localhost:3000/api/inventory";
const stockApi = "http://localhost:3000/api/stock-movements";
const supplierApi = "http://localhost:3000/api/suppliers";
const supBrandApi = "http://localhost:3000/api/sup-brands";

let allSupBrands = [];
let allProducts = [];
let allInventory = [];
let allStockMovements = [];
let allSuppliers = [];

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadInventory();
  loadStockMovements();
  loadSuppliers();
  loadSupBrands();

  document
    .getElementById("inventoryForm")
    .addEventListener("submit", handleSubmit);
  document
    .getElementById("inventorySearch")
    .addEventListener("input", filterInventory);

  // Add event listeners for modal close and print buttons
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
    const supplier = allSuppliers.find((s) => s.id === sb.supId);
    const brand = sb.brandName || `Brand ${sb.brandId}`; // update based on structure
    const option = document.createElement("option");
    option.value = sb.id;
    option.textContent = `${supplier?.name || "Supplier"} | ${brand}`;
    select.appendChild(option);
  });
}

// Load products into dropdown
async function loadProducts() {
  try {
    const res = await axios.get(productApi);
    allProducts = res.data;

    const select = document.getElementById("inventoryProduct");
    select.innerHTML = `<option value="">Select Product</option>`; // Reset options

    allProducts.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id; // use the product ID directly
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
    const product = allProducts.find((p) => p.id === inv.productId);
    const supBr = allSupBrands.find((sb) => sb.id === inv.supBrId); // 🔄 CHANGED: use inv.supBrId
    const supplier = allSuppliers.find((s) => s.id === supBr?.supId);
    const brand = supBr?.brandName || "Brand"; // 🔄 Optional: use pre-joined name if available
    const sellPrice = getLatestSellPrice(inv.id);
    const quantity = getTotalStockQuantity(inv.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${inv.name}</td>
        <td>${product?.name || "N/A"}</td>
        <td>${supplier?.name || "Supplier"}</td>
        <td>${brand}</td>
        <td>${inv.size}</td>
        <td>${inv.color}</td>
        <td>${inv.description || "-"}</td>
        <td>
          ${inv.bCodeId}
          <button onclick="openDownloadModal('${inv.bCodeId}', '${inv.name}', '${sellPrice}', '${inv.size}')">Print</button>

        </td>
        <td>${quantity}</td>
        <td>${sellPrice}</td>
        <td>
          <button class="delete" onclick="deleteInventory(${inv.id})">🗑</button>
        </td>
      `;
    tbody.appendChild(tr);
  });
}

function filterInventory() {
  const query = document.getElementById("search").value.toLowerCase();
  const filtered = allInventory.filter((inv) => {
    const product = allProducts.find((p) => p.id === inv.productId);
    return (
      inv.bCodeId.toLowerCase().includes(query) ||
      inv.color.toLowerCase().includes(query) ||
      product?.name.toLowerCase().includes(query)
    );
  });
  renderInventoryTable(filtered);
}

function getLatestSellPrice(inventoryId) {
  const entries = allStockMovements
    .filter((entry) => entry.inventoryId === inventoryId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return entries.length ? entries[0].sell_price : "-";
}
function getTotalStockQuantity(inventoryId) {
  const relevant = allStockMovements.filter(
    (entry) => entry.inventoryId === inventoryId
  );
  return relevant.reduce((sum, s) => sum + s.quantity, 0);
}

function showPriceSelectionModal(priceList, callback) {
  const modal = document.getElementById("priceSelectModal");
  const priceContainer = document.getElementById("priceOptions");
  priceContainer.innerHTML = "";

  priceList.forEach((price) => {
    const btn = document.createElement("button");
    btn.textContent = `Rs. ${price.toFixed(2)}`;
    btn.onclick = () => {
      modal.style.display = "none";
      callback(price);
    };
    priceContainer.appendChild(btn);
  });

  modal.style.display = "flex";
}

function showBarcodeLabel(barcode, inventoryName, price, size) {
    document.getElementById("barcodeDownloadModal").style.display = "flex";
  
    // ✅ Update fields
    document.getElementById("labelProductName").textContent = inventoryName;
    document.getElementById("labelSizeText").textContent = `Size: ${size}`;
    document.getElementById("labelPrice").textContent = `Rs: ${parseFloat(price).toFixed(2)}`;
    document.getElementById("labelCode").textContent = barcode;
  
    document.getElementById("barcodePreviewImg").src = `http://localhost:3000/api/barcode/${barcode}`;
    document.getElementById("labelContainer").dataset.barcode = barcode;
  
    updateLabelSize();
  }
  

async function handleSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("inventoryName").value.trim();

  const productId = parseInt(document.getElementById("inventoryProduct").value);
  const product = allProducts.find((p) => p.id === productId);
  const { gender, type } = product;

  const supBrId = parseInt(document.getElementById("inventoryCombo").value);

  const size = document.getElementById("inventorySize").value.trim();
  const color = document.getElementById("inventoryColor").value.trim();
  const description = document.getElementById("inventoryDesc").value.trim();
  const quantity = parseInt(document.getElementById("inventoryQuantity").value);
  const buy_price = parseFloat(
    document.getElementById("inventoryBuyPrice").value
  );
  const sell_price = parseFloat(
    document.getElementById("inventorySellPrice").value
  );
  const message = document.getElementById("inventoryDesc");

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
      i.bCodeId.startsWith(prefix)
    ).length;
    const padded = String(count + 1).padStart(5, "0");
    const bCodeId = `${prefix}${padded}`;

    const invResPost = await axios.post(inventoryApi, {
      name,
      productId,
      supBrId,
      size,
      color,
      description,
      bCodeId,
    });
    const inventoryId = invResPost.data.id;

    // Check if matching stock movement exists
    const existingStockRes = await axios.get(stockApi);
    const matching = existingStockRes.data.find(
      (sm) =>
        sm.inventoryId === inventoryId &&
        parseFloat(sm.buy_price) === buy_price &&
        parseFloat(sm.sell_price) === sell_price
    );

    if (matching) {
      // Update quantity if prices match
      await axios.put(`${stockApi}/${matching.id}`, {
        quantity: matching.quantity + quantity,
      });
    } else {
      // Else insert new stock movement
      await axios.post(stockApi, {
        inventoryId,
        quantity,
        buy_price,
        sell_price,
      });
    }

    message.textContent = `✅ Inventory added with Barcode: ${bCodeId}`;
    document.getElementById("inventoryForm").reset();
    loadInventory();
    loadStockMovements();
  } catch (err) {
    console.error(err);
    message.textContent = `❌ Error: ${
      err.response?.data?.error || err.message
    }`;
  }
}
function openDownloadModal(barcode, inventoryName, defaultPrice, size) {
    const inventory = allInventory.find(inv => inv.bCodeId === barcode);
    const matchingPrices = allStockMovements
      .filter(s => s.inventoryId === inventory.id && s.quantity > 0)
      .map(s => s.sell_price);
  
    const uniquePrices = [...new Set(matchingPrices.map(p => parseFloat(p)))];
  
    if (uniquePrices.length > 1) {
      showPriceSelectionModal(uniquePrices, (selectedPrice) => {
        showBarcodeLabel(barcode, inventoryName, selectedPrice, size);
      });
    } else {
      showBarcodeLabel(barcode, inventoryName, defaultPrice, size);
    }
  }
  

//function openDownloadModal(barcode, name, price) {
//document.getElementById("barcodeDownloadModal").style.display = "flex";
//document.getElementById("labelProductName").textContent = name;
//document.getElementById("labelPrice").textContent = `Rs: ${parseFloat(
//  price
//).toFixed(2)}`;
//document.getElementById("labelCode").textContent = barcode;
//document.getElementById(
//  "barcodePreviewImg"
//).src = `http://localhost:3000/api/barcode/${barcode}`;

// 🔥 This is what your downloadBarcodeAsImage/PDF relies on
//document.getElementById("labelContainer").dataset.barcode = barcode;

//updateLabelSize();
//document
//.getElementById("labelWidth")
//.addEventListener("input", updateLabelSize);
//document
// .getElementById("labelHeight")
// .addEventListener("input", updateLabelSize);
//}

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
    img.onload = () => downloadBarcodeAsImage(); // Retry when loaded
    return;
  }

  html2canvas(document.getElementById("labelContainer"), {
    useCORS: true,
    scale: 3, // 🔥 high resolution canvas for clear image
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
    img.onload = () => downloadBarcodeAsPDF(); // Retry when loaded
    return;
  }

  const labelContainer = document.getElementById("labelContainer");

  html2canvas(labelContainer, {
    useCORS: true,
    scale: 3, // 🔥 increase this value for sharper quality (2–4 is good)
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

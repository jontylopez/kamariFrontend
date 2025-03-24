const productApi = "http://localhost:3000/api/products";
const inventoryApi = "http://localhost:3000/api/inventory";
const stockApi = "http://localhost:3000/api/stock-movements";
const supplierApi = "http://localhost:3000/api/suppliers";
const supBrandApi = 'http://localhost:3000/api/sup-brands';

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
  document.getElementById("search").addEventListener("input", filterInventory);

  // Add event listeners for modal close and print buttons
  document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("barcodeDownloadModal").style.display = "none";
  });
});
async function loadSupBrands() {
  const res = await axios.get(supBrandApi);
  allSupBrands = res.data;
}
// Load products into dropdown
async function loadProducts() {
  const res = await axios.get(productApi);
  allProducts = res.data;
  const select = document.getElementById("product");
  res.data.forEach((p) => {
    const option = document.createElement("option");
    option.value = JSON.stringify(p); // stringified object
    option.textContent = `${p.name} (${p.gender} - ${p.type})`;
    select.appendChild(option);
  });
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
  const tbody = document.querySelector("#inventoryTable tbody");
  tbody.innerHTML = "";

  data.forEach((inv) => {
    const product = allProducts.find((p) => p.id === inv.productId);
    const supBr = allSupBrands.find((sb) => sb.id === product?.supBrId);
    const supplier = allSuppliers.find((s) => s.id === supBr?.supId);
    const sellPrice = getLatestSellPrice(inv.id);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${inv.bCodeId}</td>
      <td>${product?.name || "N/A"}</td>
      <td>${inv.size}</td>
      <td>${inv.color}</td>
      <td>${sellPrice}</td>
      <td>
        <button onclick="openDownloadModal('${inv.bCodeId}', '${product?.name || "Product"}', '${sellPrice}', '${supplier?.name || ""}')">Print</button>
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
  const entries = allStockMovements.filter(
    (entry) => entry.inventoryId === inventoryId && entry.movement_type === "in"
  );
  return entries.length ? entries[entries.length - 1].sell_price : "-";
}

async function handleSubmit(e) {
  e.preventDefault();
  const productData = JSON.parse(document.getElementById("product").value);
  const { id: productId, gender, type } = productData;

  const size = document.getElementById("size").value.trim();
  const color = document.getElementById("color").value.trim();
  const description = document.getElementById("description").value.trim();
  const quantity = parseInt(document.getElementById("quantity").value);
  const buy_price = parseFloat(document.getElementById("buy_price").value);
  const sell_price = parseFloat(document.getElementById("sell_price").value);
  const message = document.getElementById("message");

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
      productId,
      size,
      color,
      description,
      bCodeId,
    });
    const inventoryId = invResPost.data.id;

    await axios.post(stockApi, {
      inventoryId,
      quantity,
      movement_type: "in",
      buy_price,
      sell_price,
    });

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
function openDownloadModal(barcode, name, price) {
  document.getElementById("barcodeDownloadModal").style.display = "flex";
  document.getElementById("labelProductName").textContent = name;
  document.getElementById("labelPrice").textContent = `Rs: ${parseFloat(price).toFixed(2)}`;
  document.getElementById("labelCode").textContent = barcode;
  document.getElementById("barcodePreviewImg").src = `http://localhost:3000/api/barcode/${barcode}`;

  // 🔥 This is what your downloadBarcodeAsImage/PDF relies on
  document.getElementById("labelContainer").dataset.barcode = barcode;

  updateLabelSize();
  document.getElementById("labelWidth").addEventListener("input", updateLabelSize);
  document.getElementById("labelHeight").addEventListener("input", updateLabelSize);
}


function updateLabelSize() {
  const width = parseFloat(document.getElementById("labelWidth").value);
  const height = parseFloat(document.getElementById("labelHeight").value);
  const dpi = 3.7795; // mm to px

  const container = document.getElementById("labelContainer");
  container.style.width = `${width * dpi}px`;
  container.style.height = `${height * dpi}px`;
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
  document.getElementById("barcodePreviewImg").src = `http://localhost:3000/api/barcode/${barcode}`;
}

function closeDownloadModal() {
  document.getElementById("barcodeDownloadModal").style.display = "none";
}

function closeDownloadModal() {
  document.getElementById("barcodeDownloadModal").style.display = "none";
}

function downloadBarcodeAsImage() {
  const img = document.getElementById("barcodePreviewImg");
  const barcode = document.getElementById("labelContainer").dataset.barcode || "barcode";

  if (!img.complete) {
    img.onload = () => downloadBarcodeAsImage(); // Retry when loaded
    return;
  }

  html2canvas(document.getElementById("labelContainer"), {
    useCORS: true,
    scale: 3 // 🔥 high resolution canvas for clear image
  }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${barcode}.png`;
    link.click();
  });
}


function downloadBarcodeAsPDF() {
  const img = document.getElementById("barcodePreviewImg");
  const barcode = document.getElementById("labelContainer").dataset.barcode || "barcode";

  if (!img.complete) {
    img.onload = () => downloadBarcodeAsPDF(); // Retry when loaded
    return;
  }

  const labelContainer = document.getElementById("labelContainer");

  html2canvas(labelContainer, {
    useCORS: true,
    scale: 3  // 🔥 increase this value for sharper quality (2–4 is good)
  }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");

    const labelWidth = parseFloat(document.getElementById("labelWidth").value);
    const labelHeight = parseFloat(document.getElementById("labelHeight").value);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: labelWidth > labelHeight ? "landscape" : "portrait",
      unit: "mm",
      format: [labelWidth, labelHeight]
    });

    pdf.addImage(imgData, "PNG", 0, 0, labelWidth, labelHeight);
    pdf.save(`${barcode}.pdf`);
  });
}


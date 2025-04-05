const supplierApi = 'http://localhost:3000/api/suppliers';
const brandApi = 'http://localhost:3000/api/brands';
const comboApi = 'http://localhost:3000/api/sup-brands';
const productApi = 'http://localhost:3000/api/products';

let suppliers = [];
let brands = [];
let combinations = [];
let products = [];

document.addEventListener("DOMContentLoaded", () => {
  loadSuppliers();
  loadBrands();
  loadCombinations();
  loadProducts();

  document.getElementById("supplierForm").addEventListener("submit", addSupplier);
  document.getElementById("brandForm").addEventListener("submit", addBrand);
  document.getElementById("comboForm").addEventListener("submit", addCombo);
  document.getElementById("productForm").addEventListener("submit", addProduct);


  // Search filters
document.getElementById("supplierSearch").addEventListener("input", () => {
    filterTable("supplierTableBody", "supplierSearch");
  });
  
  document.getElementById("brandSearch").addEventListener("input", () => {
    filterTable("brandTableBody", "brandSearch");
  });
  
  document.getElementById("comboSearch").addEventListener("input", () => {
    filterTable("comboTableBody", "comboSearch");
  });
  
  document.getElementById("productSearch").addEventListener("input", () => {
    filterTable("productTableBody", "productSearch");
  });
  
  function filterTable(tbodyId, inputId) {
    const filter = document.getElementById(inputId).value.toLowerCase();
    const rows = document.getElementById(tbodyId).getElementsByTagName("tr");
  
    Array.from(rows).forEach(row => {
      const rowText = row.textContent.toLowerCase();
      row.style.display = rowText.includes(filter) ? "" : "none";
    });
  }
  
});

// Load Functions
async function loadSuppliers() {
    try {
      const res = await axios.get(supplierApi);
      console.log("Supplier data:", res.data); // 🐞 Debug log
      suppliers = res.data;
  
      const table = document.getElementById("supplierTableBody");
      if (!table) {
        console.error("supplierTableBody not found!");
        return;
      }
  
      table.innerHTML = "";
      document.getElementById("comboSupplier").innerHTML = "";
  
      suppliers.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${s.name}</td>
          <td>${s.tel || '-'}</td>
          <td>${s.email || '-'}</td>
          <td>${s.address || '-'}</td>
          <td><button onclick="deleteSupplier(${s.id})">🗑</button></td>
        `;
        table.appendChild(tr);
  
        const option = document.createElement("option");
        option.value = s.id;
        option.textContent = s.name;
        document.getElementById("comboSupplier").appendChild(option);
      });
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  }
  

  async function loadBrands() {
    const res = await axios.get(brandApi);
    brands = res.data;
    const table = document.getElementById("brandTableBody");
    if (!table) return;
    table.innerHTML = "";
    document.getElementById("comboBrand").innerHTML = "";
  
    brands.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.name}</td>
        <td><button onclick="deleteBrand(${b.id})">🗑</button></td>
      `;
      table.appendChild(tr);
  
      const option = document.createElement("option");
      option.value = b.id;
      option.textContent = b.name;
      document.getElementById("comboBrand").appendChild(option);
    });
  }
  

  async function loadCombinations() {
    const res = await axios.get(comboApi);
    combinations = res.data;
    const table = document.getElementById("comboTableBody");
    if (!table) return;
    table.innerHTML = "";
  
    combinations.forEach((cb) => {
      const sup = suppliers.find(s => s.id === cb.sup_id);
      const br = brands.find(b => b.id === cb.brand_id);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sup?.name || 'N/A'}</td>
        <td>${br?.name || 'N/A'}</td>
        <td><button onclick="deleteCombo(${cb.id})">🗑</button></td>
      `;
      table.appendChild(tr);
    });
  }
  

  async function loadProducts() {
    const res = await axios.get(productApi);
    products = res.data;
    const table = document.getElementById("productTableBody");
    if (!table) return;
    table.innerHTML = "";
  
    products.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.gender}</td>
        <td>${p.type}</td>
        <td><button onclick="deleteProduct(${p.id})">🗑</button></td>
      `;
      table.appendChild(tr);
    });
  }
  

// Add Functions
async function addSupplier(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById("supplierName").value,
    tel: document.getElementById("supplierTel").value,
    email: document.getElementById("supplierEmail").value,
    address: document.getElementById("supplierAddress").value,
  };
  await axios.post(supplierApi, data);
  e.target.reset();
  loadSuppliers();
}

async function addBrand(e) {
  e.preventDefault();
  const data = { name: document.getElementById("brandName").value };
  await axios.post(brandApi, data);
  e.target.reset();
  loadBrands();
}

async function addCombo(e) {
  e.preventDefault();
  const data = {
    sup_id: parseInt(document.getElementById("comboSupplier").value),
    brand_id: parseInt(document.getElementById("comboBrand").value)
  };
  await axios.post(comboApi, data);
  loadCombinations();
}

async function addProduct(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById("productName").value,
    gender: document.getElementById("productGender").value,
    type: document.getElementById("productType").value,
  };
  await axios.post(productApi, data);
  e.target.reset();
  loadProducts();
}

// Delete Functions
async function deleteSupplier(id) {
  if (confirm("Delete this supplier?")) {
    await axios.delete(`${supplierApi}/${id}`);
    loadSuppliers();
    loadCombinations();
  }
}

async function deleteBrand(id) {
  if (confirm("Delete this brand?")) {
    await axios.delete(`${brandApi}/${id}`);
    loadBrands();
    loadCombinations();
  }
}

async function deleteCombo(id) {
  if (confirm("Delete this combo?")) {
    await axios.delete(`${comboApi}/${id}`);
    loadCombinations();
  }
}

async function deleteProduct(id) {
  if (confirm("Delete this product?")) {
    await axios.delete(`${productApi}/${id}`);
    loadProducts();
  }
}

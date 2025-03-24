const supplierApi = 'http://localhost:3000/api/suppliers';
const brandApi = 'http://localhost:3000/api/brands';
const supBrandApi = 'http://localhost:3000/api/sup-brands';
const productApi = 'http://localhost:3000/api/products';

document.addEventListener('DOMContentLoaded', () => {
  loadSuppliers();
  loadBrands();
  loadProducts();

  document.getElementById('productForm').addEventListener('submit', handleSubmit);
});

async function loadSuppliers() {
  const res = await axios.get(supplierApi);
  const select = document.getElementById('supplier');
  res.data.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name;
    select.appendChild(option);
  });
}

async function loadBrands() {
  const res = await axios.get(brandApi);
  const select = document.getElementById('brand');
  res.data.forEach(b => {
    const option = document.createElement('option');
    option.value = b.id;
    option.textContent = b.name;
    select.appendChild(option);
  });
}

async function loadProducts() {
  const list = document.getElementById('productList');
  list.innerHTML = '';
  const res = await axios.get(productApi);
  res.data.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.gender} - ${p.type})`;
    list.appendChild(li);
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const gender = document.getElementById('gender').value;
  const type = document.getElementById('type').value;
  const supId = document.getElementById('supplier').value;
  const brandId = document.getElementById('brand').value;
  const message = document.getElementById('message');

  try {
    // 1. Check if sup_brand exists
    let supBrandId;
    const res = await axios.get(`${supBrandApi}/get/${supId}/${brandId}`);
    supBrandId = res.data;

    // 2. Create product
    const product = await axios.post(productApi, {
      name,
      gender,
      type,
      supBrId: supBrandId
    });

    message.textContent = '✅ Product created!';
    document.getElementById('productForm').reset();
    loadProducts();
  } catch (err) {
    // If sup_brand doesn’t exist, create it then try again
    if (err.response?.status === 400 || err.response?.status === 404) {
      try {
        const newSupBrand = await axios.post(supBrandApi, {
          supId,
          brandId
        });
        const supBrandId = newSupBrand.data.id;

        const product = await axios.post(productApi, {
          name,
          gender,
          type,
          supBrId: supBrandId
        });

        message.textContent = '✅ Product created!';
        document.getElementById('productForm').reset();
        loadProducts();
      } catch (error) {
        message.textContent = '❌ Error creating product';
        console.error(error);
      }
    } else {
      message.textContent = '❌ ' + (err.response?.data?.error || 'Unknown error');
    }
  }
}

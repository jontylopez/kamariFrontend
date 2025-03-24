const apiUrl = 'http://localhost:3000/api/suppliers';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('supplierForm');
  const message = document.getElementById('message');
  const supplierList = document.getElementById('supplierList');

  // Load all suppliers on page load
  loadSuppliers();

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      name: document.getElementById('name').value,
      tel: document.getElementById('tel').value,
      email: document.getElementById('email').value,
      address: document.getElementById('address').value
    };

    try {
      const res = await axios.post(apiUrl, data);
      message.textContent = "Supplier added successfully!";
      form.reset();
      loadSuppliers();
    } catch (err) {
      message.textContent = err.response?.data?.error || 'Error adding supplier';
    }
  });

  async function loadSuppliers() {
    supplierList.innerHTML = '';
    try {
      const res = await axios.get(apiUrl);
      res.data.forEach(supplier => {
        const li = document.createElement('li');
        li.textContent = `${supplier.name} (${supplier.email})`;
        supplierList.appendChild(li);
      });
    } catch (err) {
      console.error('Error fetching suppliers:', err.message);
    }
  }
});

const apiUrl = 'http://localhost:3000/api/brands';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('brandForm');
  const message = document.getElementById('message');
  const brandList = document.getElementById('brandList');

  loadBrands();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('brandName').value
    };

    try {
      const res = await axios.post(apiUrl, data);
      message.textContent = '✅ Brand added successfully!';
      form.reset();
      loadBrands();
    } catch (err) {
      message.textContent = '❌ ' + (err.response?.data?.error || 'Error adding brand');
    }
  });

  async function loadBrands() {
    brandList.innerHTML = '';
    try {
      const res = await axios.get(apiUrl);
      res.data.forEach(brand => {
        const li = document.createElement('li');
        li.textContent = `${brand.name}`;
        brandList.appendChild(li);
      });
    } catch (err) {
      console.error('Error fetching brands:', err.message);
    }
  }
});

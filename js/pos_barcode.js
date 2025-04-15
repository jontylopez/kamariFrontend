import { addToCart, highlightCartItem } from './pos_cart.js';
import { showPriceSelectionModal, renderExchangeItems } from './pos_modals.js';
import { getCartItems, getExchangeItems, addExchangeItem } from './pos_state.js';

const inventoryApi = "http://localhost:3000/api/inventory";

const scannedStockMovements = new Map();

// === Barcode Scanning Handler ===
export async function handleBarcodeScan(e) {
  if (e.key !== "Enter") return;

  const code = e.target.value.trim();
  if (!code) return;
  e.target.value = "";

  try {
    const res = await axios.get(`${inventoryApi}/barcode/${code}`);
    const { inventory, stockMovements } = res.data;

    const cartItems = getCartItems();

    const validStocks = stockMovements.filter((stock) => {
      const alreadyInCartQty = getCartQty(stock.id, cartItems);
      return stock.quantity - alreadyInCartQty > 0;
    });

    if (validStocks.length === 0) {
      alert("❌ No more stock available for this item.");
      return;
    }

    const baseItem = {
      id: inventory.id,
      name: inventory.name || inventory.Product?.name || "Unnamed",
      size: inventory.size || "-",
      color: inventory.color || "-",
      quantity: 1,
      discount: 0,
    };

    const handleAdd = (stock) => {
      const alreadyInCart = getCartQty(stock.id, cartItems);
      const remaining = stock.quantity - alreadyInCart;

      console.log(`🛒 Scanned Stock ID: ${stock.id}, Remaining Quantity: ${remaining}`);

      const item = {
        ...baseItem,
        price: parseFloat(stock.sell_price),
        total: parseFloat(stock.sell_price),
        stockMovementId: stock.id,
        maxAvailable: remaining
      };

      scannedStockMovements.set(stock.id, stock.quantity);
      addToCart(item);
      highlightCartItem(getCartItems().length - 1);
    };

    if (validStocks.length === 1) {
      handleAdd(validStocks[0]);
    } else {
      showPriceSelectionModal(inventory.name, validStocks, (selected) => {
        handleAdd(selected);
      });
    }
  } catch (err) {
    console.error("❌ Barcode error:", err);
    alert("Item not found.");
  }
}

function getCartQty(stockMovementId, cartItems) {
  return cartItems
    .filter((item) => item.stockMovementId === stockMovementId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export async function handleExchangeBarcodeScan(e) {
  if (e.key !== "Enter") return;

  const code = e.target.value.trim();
  if (!code) return;
  e.target.value = "";

  try {
    const res = await axios.get(`http://localhost:3000/api/inventory/barcode/${code}`);
    const { inventory, stockMovements } = res.data;

    if (stockMovements.length === 0) return alert("❌ No stock data found.");

    const validStocks = stockMovements.filter((s) => s.quantity >= 0);
    if (validStocks.length === 0) return alert("❌ No returnable stock entries.");

    const handleSelect = (stock) => {
      const exchangeItems = getExchangeItems();
      const existing = exchangeItems.find(
        (item) => item.inventory_id === inventory.id && item.stock_movement_id === stock.id
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        addExchangeItem({
          inventory_id: inventory.id,
          name: inventory.Product?.name || inventory.name || "Unnamed",
          size: inventory.size || "-",
          color: inventory.color || "-",
          quantity: 1,
          price: parseFloat(stock.sell_price),
          buy_price: parseFloat(stock.buy_price),
          stock_movement_id: stock.id,
          sell_price: parseFloat(stock.sell_price)
        });
      }

      renderExchangeItems(); 
    };

    if (validStocks.length === 1) {
      handleSelect(validStocks[0]);
    } else {
      showPriceSelectionModal(inventory.name, validStocks, handleSelect); 
    }

  } catch (err) {
    console.error("❌ Error scanning for return:", err);
    alert("Item not found or cannot be returned.");
  }
}

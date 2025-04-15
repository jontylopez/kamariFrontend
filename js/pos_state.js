// pos_state.js
let _sessionActive = false;
let _currentSessionId = null;
let _cartItems = [];
let exchangeItems = [];
let _exchangeData = null; 
let selectedCustomerId = null;

export function getSessionActive() {
  return _sessionActive;
}

export function setSessionActive(val) {
  _sessionActive = val;
}

export function getCurrentSessionId() {
  return _currentSessionId;
}

export function setCurrentSessionId(id) {
  _currentSessionId = id;
}

export function getCartItems() {
  return _cartItems;
}

export function clearCartItems() {
  _cartItems = [];
}

export function getExchangeData() {
  return _exchangeData;
}

export function setExchangeData(data) {
  _exchangeData = data;
}

export function getSelectedCustomerId() {
  return selectedCustomerId;
}

export function setSelectedCustomerId(id) {
  selectedCustomerId = id;
}
export function getExchangeItems() {
  return exchangeItems;
}

export function setExchangeItems(items) {
  exchangeItems = items;
}

export function addExchangeItem(item) {
  exchangeItems.push(item);
}

export function updateExchangeItem(index, data) {
  exchangeItems[index] = { ...exchangeItems[index], ...data };
}

export function removeExchangeItem(index) {
  exchangeItems.splice(index, 1);
}

export function clearExchangeItems() {
  exchangeItems = [];
}
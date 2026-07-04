document.addEventListener('DOMContentLoaded', () => {
  const cart = [];
  const cartList = document.getElementById('cartItems');
  const cartDataField = document.getElementById('cartData');

  document.querySelectorAll('.add-to-cart').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      const name = button.dataset.name;
      const price = button.dataset.price;

      cart.push({ id, name, price, quantity: 1 });

      // Update cart display
      cartList.innerHTML = '';
      cart.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.name} - $${item.price} (x${item.quantity})`;
        cartList.appendChild(li);
      });

      // Save cart data into hidden field
      cartDataField.value = JSON.stringify(cart);
    });
  });
});

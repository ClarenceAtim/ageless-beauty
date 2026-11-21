/* Cart page, checkout form and order confirmation.
   Orders are order REQUESTS: no payment is taken on this site. The shop
   does not have an order email yet (the client sends it later), so for
   now each order is saved in the customer's own browser (localStorage)
   and shown on the confirmation page. Once the shop's order email is
   set up, this file gets the FormSubmit send step (same pattern as the
   Medieval Armour Shop) so orders also reach the shop's inbox. The shop
   confirms the order and payment details by email. */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }

  /* ---------------- cart page ---------------- */
  function renderCart() {
    var body = el('cart-lines');
    if (!body) return;
    var cart = AB.getCart();
    var wrap = el('cart-wrap');
    var empty = el('cart-empty');
    if (!cart.length) {
      if (wrap) wrap.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (wrap) wrap.style.display = 'block';
    if (empty) empty.style.display = 'none';
    var total = 0;
    var html = '';
    cart.forEach(function (it, i) {
      var line = it.price * it.qty;
      total += line;
      html += '<tr><td><a href="/product/' + it.slug + '/"><img src="' +
        AB.escapeHtml(it.img) + '" alt=""></a></td>' +
        '<td><a href="/product/' + it.slug + '/">' + AB.escapeHtml(it.name) + '</a></td>' +
        '<td>' + AB.formatEUR(it.price) + '</td>' +
        '<td><input type="number" min="1" max="99" value="' + it.qty +
        '" data-qty="' + i + '" aria-label="Quantity"></td>' +
        '<td>' + AB.formatEUR(line) + '</td>' +
        '<td><button type="button" class="rm" data-rm="' + i + '">Remove</button></td></tr>';
    });
    body.innerHTML = html;
    var t = el('cart-total');
    if (t) t.textContent = AB.formatEUR(total);
    var st = el('cart-subtotal');
    if (st) st.textContent = AB.formatEUR(total);
    body.querySelectorAll('[data-qty]').forEach(function (input) {
      input.addEventListener('change', function () {
        var cart2 = AB.getCart();
        var idx = parseInt(this.getAttribute('data-qty'), 10);
        var q = Math.max(1, Math.min(99, parseInt(this.value, 10) || 1));
        if (cart2[idx]) { cart2[idx].qty = q; AB.saveCart(cart2); renderCart(); }
      });
    });
    body.querySelectorAll('[data-rm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cart2 = AB.getCart();
        cart2.splice(parseInt(this.getAttribute('data-rm'), 10), 1);
        AB.saveCart(cart2);
        renderCart();
      });
    });
  }

  /* ---------------- checkout page ---------------- */
  function orderNumber() {
    var d = new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var rand = '';
    for (var i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
    return 'AB-' + ymd + '-' + rand;
  }

  function renderCheckoutSummary() {
    var box = el('checkout-summary');
    if (!box) return;
    var cart = AB.getCart();
    if (!cart.length) {
      box.innerHTML = '<p>Your cart is empty. <a href="/">Continue shopping</a>.</p>';
      var btn = el('place-order');
      if (btn) btn.disabled = true;
      return;
    }
    var total = 0;
    var html = '<table class="lines"><thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
    cart.forEach(function (it) {
      total += it.price * it.qty;
      html += '<tr><td>' + AB.escapeHtml(it.name) + '</td><td>' + it.qty +
        '</td><td>' + AB.formatEUR(it.price * it.qty) + '</td></tr>';
    });
    html += '</tbody></table><div class="totals"><div class="row grand"><span>Total</span><span>' +
      AB.formatEUR(total) + '</span></div></div>' +
      '<p style="font-size:.9rem;color:#6b645a;">Shipping costs are to be confirmed by the store.</p>';
    box.innerHTML = html;
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function placeOrder(ev) {
    ev.preventDefault();
    var cart = AB.getCart();
    if (!cart.length) { AB.toast('Your cart is empty.'); return; }
    var fields = ['f-name', 'f-email', 'f-address', 'f-city', 'f-postcode', 'f-country'];
    var ok = true;
    fields.forEach(function (id) {
      var input = el(id);
      var err = el(id + '-err');
      var bad = !input.value.trim() || (id === 'f-email' && !validEmail(input.value.trim()));
      if (err) err.textContent = bad ? (id === 'f-email' ? 'Enter a valid email address.' : 'This field is required.') : '';
      if (bad) ok = false;
    });
    if (!ok) return;
    var total = cart.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
    var order = {
      number: orderNumber(),
      date: new Date().toISOString(),
      items: cart,
      total: Math.round(total * 100) / 100,
      customer: {
        name: el('f-name').value.trim(),
        email: el('f-email').value.trim(),
        address: el('f-address').value.trim(),
        city: el('f-city').value.trim(),
        postcode: el('f-postcode').value.trim(),
        country: el('f-country').value,
        notes: el('f-notes') ? el('f-notes').value.trim() : ''
      }
    };
    var orders = AB.readLS(AB.ORDERS_KEY, []);
    orders.push(order);
    AB.writeLS(AB.ORDERS_KEY, orders);
    AB.saveCart([]);
    location.href = '/order-confirmation/?order=' + encodeURIComponent(order.number);
  }

  /* ---------------- confirmation page ---------------- */
  function renderConfirmation() {
    var box = el('confirmation-box');
    if (!box) return;
    var m = /[?&]order=([^&]*)/.exec(location.search);
    var num = m ? decodeURIComponent(m[1]) : '';
    var orders = AB.readLS(AB.ORDERS_KEY, []);
    var order = null;
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].number === num) { order = orders[i]; break; }
    }
    if (!order) {
      box.innerHTML = '<p>We could not find that order on this device. Orders are saved in the ' +
        'browser they were placed from — if you placed it on another device, it will not show here.</p>' +
        '<p><a class="btn" href="/">Continue shopping</a></p>';
      return;
    }
    var html = '<p>Thank you, ' + AB.escapeHtml(order.customer.name) +
      '. Your order request has been received.</p>' +
      '<p><strong>Order number: ' + AB.escapeHtml(order.number) + '</strong><br>' +
      'Please keep this number for your records.</p>' +
      '<p>The shop will confirm your order and send payment details to <strong>' +
      AB.escapeHtml(order.customer.email) + '</strong>. No payment has been taken.</p>' +
      '<h2>Order summary</h2><table class="lines"><thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
    order.items.forEach(function (it) {
      html += '<tr><td>' + AB.escapeHtml(it.name) + '</td><td>' + it.qty +
        '</td><td>' + AB.formatEUR(it.price * it.qty) + '</td></tr>';
    });
    html += '</tbody></table><div class="totals"><div class="row grand"><span>Total</span><span>' +
      AB.formatEUR(order.total) + '</span></div></div>' +
      '<p style="font-size:.9rem;color:#6b645a;">Delivery to: ' +
      AB.escapeHtml(order.customer.address) + ', ' + AB.escapeHtml(order.customer.city) + ' ' +
      AB.escapeHtml(order.customer.postcode) + ', ' + AB.escapeHtml(order.customer.country) + '.</p>' +
      '<p><a class="btn" href="/">Continue shopping</a></p>';
    box.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();
    renderCheckoutSummary();
    renderConfirmation();
    var form = el('checkout-form');
    if (form) form.addEventListener('submit', placeOrder);
  });
})();

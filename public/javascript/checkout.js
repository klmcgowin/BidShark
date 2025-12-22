import * as sideBar from './sideBar.js';

// 初始化 Sidebar
fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = html;
        sideBar.collapse();
    });

let cartTotal = 0;
let shippingCost = 60; // 預設標準運費

document.addEventListener('DOMContentLoaded', () => {
    loadCheckoutItems();
    setupEventListeners();
});

// 1. 載入購物車商品
async function loadCheckoutItems() {
    try {
        const res = await fetch('/api/cart');
        const data = await res.json();
        const items = data.items || [];
        
        const container = document.getElementById('cartItemsList');
        
        if(items.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">購物車是空的</p>';
            return;
        }

        container.innerHTML = '';
        cartTotal = 0;

        items.forEach(item => {
            const itemTotal = item.price * (item.quantity || 1);
            cartTotal += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.innerHTML = `
                <img src="${item.productImage || 'Image/default-item.jpg'}" alt="Item">
                <div style="flex:1;">
                    <div style="font-weight:500; color:var(--text-color);">${item.title}</div>
                    <div style="font-size:13px; color:#888;">x ${item.quantity || 1}</div>
                </div>
                <div style="font-weight:bold; color:var(--text-color);">NT$${itemTotal.toLocaleString()}</div>
            `;
            container.appendChild(div);
        });

        updateSummary();

    } catch (err) {
        console.error(err);
    }
}

// 2. 更新金額摘要
function updateSummary() {
    document.getElementById('subtotal').textContent = `NT$${cartTotal.toLocaleString()}`;
    document.getElementById('shippingFee').textContent = `NT$${shippingCost}`;
    
    const grandTotal = cartTotal + shippingCost;
    document.getElementById('grandTotal').textContent = `NT$${grandTotal.toLocaleString()}`;
}

// 3. 事件監聽器設定
function setupEventListeners() {
    // A. 運送方式切換
    document.querySelectorAll('input[name="shipping"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            // 更新 UI 樣式
            document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
            e.target.closest('.radio-card').classList.add('selected');
            
            // 更新運費
            shippingCost = parseInt(e.target.value);
            updateSummary();
        });
    });

    // B. 付款方式 Tab 切換
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.tab-btn').dataset.target;
            
            // UI 更新
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.closest('.tab-btn').classList.add('active');

            // 內容切換
            document.querySelectorAll('.payment-content').forEach(c => c.classList.remove('active'));
            if(target === 'credit-card') {
                document.getElementById('credit-card-form').classList.add('active');
            } else {
                document.getElementById('cod-content').classList.add('active');
            }
        });
    });

    // C. 信用卡號碼自動格式化 (每4碼加空格)
    const ccInput = document.getElementById('cc-number');
    ccInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // 只留數字
        value = value.replace(/(.{4})/g, '$1 ').trim(); // 每4個加空格
        e.target.value = value;
    });

    // D. 有效期限自動格式化 (MM/YY)
    const expiryInput = document.getElementById('cc-expiry');
    expiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.slice(0, 2) + '/' + value.slice(2, 4);
        }
        e.target.value = value;
    });

    // E. 送出訂單
    document.getElementById('placeOrderBtn').addEventListener('click', handleCheckout);
}

// 4. 結帳送出邏輯
async function handleCheckout() {
    const name = document.getElementById('receiverName').value;
    const phone = document.getElementById('receiverPhone').value;
    const address = document.getElementById('receiverAddress').value;
    
    // 基本驗證
    if(!name || !phone || !address) {
        alert('請完整填寫收件資訊');
        return;
    }

    // 判斷付款方式
    const isCreditCard = document.querySelector('.tab-btn[data-target="credit-card"]').classList.contains('active');
    
    if (isCreditCard) {
        const ccNum = document.getElementById('cc-number').value;
        const ccCvv = document.getElementById('cc-cvv').value;
        // 簡單驗證長度
        if(ccNum.replace(/\s/g, '').length < 16 || ccCvv.length < 3) {
            alert('請輸入正確的信用卡資訊');
            return;
        }
    }

    // 模擬處理中
    const btn = document.getElementById('placeOrderBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 處理中...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // 這裡如果不傳 cartIds 代表全結
                shippingInfo: { name, phone, address, method: shippingCost === 60 ? 'Standard' : 'Express' },
                paymentMethod: isCreditCard ? 'CreditCard' : 'COD'
            })
        });
        
        const result = await res.json();
        
        if(res.ok) {
            alert('訂單已建立成功！感謝您的購買。');
            // === 成功結帳後，跳轉回首頁或歷史訂單頁 ===
            window.location.href = '/homePage.html';
        } else {
            alert(result.error || '結帳失敗');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert('系統忙碌中');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
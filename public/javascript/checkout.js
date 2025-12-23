import * as sideBar from './sideBar.js';

// 初始化 Sidebar
fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        if(sidebar) {
            sidebar.innerHTML = html;
            sideBar.collapse();
        }
    });

let cartTotal = 0;
let shippingCost = 60; // 預設標準運費

// 1. 讀取要結帳的商品 ID
const selectedCartIds = JSON.parse(sessionStorage.getItem('selected_cart_ids') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    // 安全檢查：如果沒有選中任何商品，導回購物車
    if (selectedCartIds.length === 0) {
        alert("請先從購物車選擇商品");
        window.location.href = 'cart.html';
        return;
    }

    loadCheckoutItems();
    setupEventListeners();
});

// 2. 載入購物車商品 (並篩選)
async function loadCheckoutItems() {
    try {
        const res = await fetch('/api/cart');
        const data = await res.json();
        const allItems = data.items || [];
        
        // 只保留被勾選的商品
        const items = allItems.filter(item => selectedCartIds.includes(item._id));
        
        const container = document.getElementById('cartItemsList');
        
        if(items.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">找不到選中的商品</p>';
            return;
        }

        container.innerHTML = '';
        cartTotal = 0;

        items.forEach(item => {
            const qty = item.quantity || 1;
            const itemTotal = item.price * qty;
            cartTotal += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.innerHTML = `
                <img src="${item.productImage || 'Image/default-item.jpg'}" alt="Item" onerror="this.src='/Image/default-item.jpg'">
                <div style="flex:1;">
                    <div style="font-weight:500; color:var(--text-color);">${item.title}</div>
                    <div style="font-size:13px; color:#888;">x ${qty}</div>
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

// 3. 更新金額摘要
function updateSummary() {
    document.getElementById('subtotal').textContent = `NT$${cartTotal.toLocaleString()}`;
    document.getElementById('shippingFee').textContent = `NT$${shippingCost}`;
    
    const grandTotal = cartTotal + shippingCost;
    document.getElementById('grandTotal').textContent = `NT$${grandTotal.toLocaleString()}`;
}

// 4. 事件監聽器設定
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
            const target = e.target.dataset.target; // 修正選取邏輯
            
            // UI 更新
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active'); // 修正

            // 內容切換
            document.querySelectorAll('.payment-content').forEach(c => c.classList.remove('active'));
            if(target === 'credit-card') {
                document.getElementById('credit-card-form').classList.add('active');
            } else {
                document.getElementById('cod-content').classList.add('active');
            }
        });
    });

    // C. 信用卡號碼自動格式化
    const ccInput = document.getElementById('cc-number');
    if(ccInput) {
        ccInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.replace(/(.{4})/g, '$1 ').trim();
            e.target.value = value;
        });
    }

    // D. 有效期限自動格式化
    const expiryInput = document.getElementById('cc-expiry');
    if(expiryInput) {
        expiryInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }

    // E. 送出訂單
    document.getElementById('placeOrderBtn').addEventListener('click', handleCheckout);
}

// 5. 結帳送出邏輯
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
        if(ccNum.replace(/\s/g, '').length < 16 || ccCvv.length < 3) {
            alert('請輸入正確的信用卡資訊');
            return;
        }
    }

    // 模擬處理中
    const btn = document.getElementById('placeOrderBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '處理中...'; // 移除 fontawesome 依賴，避免沒引入時不顯示
    btn.disabled = true;

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // 🔥 關鍵修改：必須傳送 cartIds
                cartIds: selectedCartIds, 
                shippingInfo: { 
                    name, 
                    phone, 
                    address, 
                    method: shippingCost === 60 ? 'Standard' : 'Express' 
                },
                paymentMethod: isCreditCard ? 'CreditCard' : 'COD'
            })
        });
        
        const result = await res.json();
        
        if(res.ok) {
            alert('🎉 訂單已建立成功！感謝您的購買。');
            
            // 清除 sessionStorage，避免下次進來還抓到舊的 ID
            sessionStorage.removeItem('selected_cart_ids');
            
            // 跳轉回購物車頁面 (顯示歷史訂單)
            window.location.href = '/cart.html'; 
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
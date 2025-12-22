import * as sideBar from './sideBar.js';

// --- 初始化側邊欄 ---
fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = html;
        const links = sidebar.querySelectorAll('a.nav-item');
        const currentPage = window.location.pathname.split('/').pop();
        links.forEach(link => {
            if (link.getAttribute('href') === currentPage) link.classList.add('active');
        });
        sideBar.collapse();
    });

// ==========================================
//  功能 1: 購物車與結帳導向
// ==========================================

async function loadCart() {
    const container = document.getElementById('cart-container');
    const checkoutBar = document.getElementById('checkout-bar');
    
    try {
        const res = await fetch('/api/cart'); 
        if (res.status === 401) {
            container.innerHTML = '<p class="col-12 text-danger text-center">請先登入以查看購物車</p>';
            return;
        }
        
        const data = await res.json();
        const items = data.items || [];

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="col-12 empty-msg">目前沒有待付款的商品</div>';
            checkoutBar.style.display = 'none';
            return;
        }

        checkoutBar.style.display = 'flex';
        container.innerHTML = '';

        items.forEach(item => {
            let imgSrc = '/Image/default-item.jpg';
            if (Array.isArray(item.productImage) && item.productImage.length > 0) imgSrc = item.productImage[0];
            else if (typeof item.productImage === 'string') imgSrc = item.productImage;

            const qty = item.quantity || 1; 
            const div = document.createElement('div');
            div.className = 'col-md-4 col-sm-6'; 
            div.innerHTML = `
                <div class="card cart-item-card" style="width: 100%; margin-bottom: 20px;">
                    <img class="card-img-top" src="${imgSrc}" style="height: 200px; object-fit: cover;" onerror="this.src='/Image/default-item.jpg'">
                    <div class="card-body">
                        <div style="display:flex; align-items:flex-start;">
                            <input type="checkbox" class="cart-checkbox" 
                                   style="margin-top: 5px; margin-right: 10px; transform: scale(1.5);"
                                   data-id="${item._id}" 
                                   data-price="${item.price}" 
                                   data-quantity="${qty}"
                                   checked>
                            <div style="width: 100%;">
                                <h5 class="card-title">${item.title}</h5>
                                <p class="card-text text-success font-weight-bold">
                                    單價: $${item.price.toLocaleString()} <br>
                                    <span style="color: #666; font-size: 0.9em;">數量: ${qty}</span>
                                    ${item.isDirectBuy ? '<span class="badge badge-warning ml-2">直購品</span>' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        const checkboxes = document.querySelectorAll('.cart-checkbox');
        checkboxes.forEach(box => box.addEventListener('change', updateTotal));
        updateTotal();

        const btnCheckout = document.getElementById('btn-checkout');
        if (btnCheckout) {
             btnCheckout.onclick = goToCheckoutPage; 
        }

    } catch (error) {
        console.error('Load cart failed:', error);
        container.innerHTML = '<p class="col-12 text-center">載入失敗，請稍後再試</p>';
    }
}

function updateTotal() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    let total = 0;
    checkboxes.forEach(box => {
        const price = parseFloat(box.dataset.price);
        const qty = parseInt(box.dataset.quantity || 1);
        total += price * qty;
    });
    document.getElementById('total-price').innerText = '$' + total.toLocaleString();
    document.getElementById('btn-checkout').disabled = (checkboxes.length === 0);
}

// 導向到安全結帳頁面
async function goToCheckoutPage() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    if (checkboxes.length === 0) { alert('請至少選擇一項商品'); return; }

    const cartIds = Array.from(checkboxes).map(box => box.dataset.id);
    sessionStorage.setItem('selected_cart_ids', JSON.stringify(cartIds));

    window.location.href = '/checkout.html';
}

// ==========================================
//  功能 2: 載入競標中商品與歷史訂單
// ==========================================
async function loadBids() {
    const bidContainer = document.getElementById('bidItems');
    try {
        const [resBids, resSession] = await Promise.all([
            fetch('/api/read/getAllBid'),
            fetch('/api/info/session', { method: 'POST', credentials: 'include' })
        ]);

        if(!resBids.ok) throw new Error('Failed');
        const bids = await resBids.json();
        const session = resSession.ok ? await resSession.json() : null;
        const myUserId = session?.id ? String(session.id) : null;
        const itemMap = new Map();

        for (const bid of bids) {
            const item = bid.auctionItem?.[0];
            if (!item || item.status === 'inactive') continue;
            const itemId = String(item._id);
            let entry = itemMap.get(itemId);
            if (!entry) {
                entry = { ...item, displayImage: Array.isArray(item.images) ? item.images[0] : item.images, currentPrice: Number(item.currentPrice||0), yourBid: null };
            }
            let bidderId = bid.bidderId?._id ?? bid.bidderId ?? bid.userId?._id ?? bid.userId;
            bidderId = bidderId ? String(bidderId) : null;
            
            if (Number(item.currentPrice) > Number(entry.currentPrice)) entry.currentPrice = item.currentPrice;
            if (myUserId && bidderId === myUserId) entry.yourBid = Math.max(entry.yourBid || 0, Number(bid.price));
            itemMap.set(itemId, entry);
        }

        const itemYouBid = Array.from(itemMap.values()).filter(e => e.yourBid !== null);
        if (itemYouBid.length === 0) {
            bidContainer.innerHTML = '<div class="col-12 empty-msg">目前沒有進行中的競標</div>';
            return;
        }

        bidContainer.innerHTML = '';
        itemYouBid.forEach(item => {
            const div = document.createElement('div');
            div.className = 'col-md-4 col-sm-6';
            
            // 修改：加入 cursor: pointer 讓使用者知道可點擊
            div.innerHTML = `
                <div class="card" style="width: 100%; margin-bottom: 20px; cursor: pointer;">
                    <img class="card-img-top" src="${item.displayImage || '/Image/default-item.jpg'}" style="height: 150px; object-fit: cover;" onerror="this.src='/Image/default-item.jpg'">
                    <div class="card-body">
                        <h5 class="card-title">${item.title}</h5>
                        <p class="card-text">目前最高: <b>$${item.currentPrice}</b><br>你的出價: <b>$${item.yourBid ?? 0}</b></p>
                    </div>
                </div>`;
            
            // 修改：為整個卡片加入點擊事件，跳轉到商品詳情頁
            div.querySelector('.card').addEventListener('click', () => {
                window.location.href = `auctionItem.html?id=${item._id}`;
            });

            bidContainer.appendChild(div);
        });
    } catch (e) { bidContainer.innerHTML = '<p class="col-12 text-center text-muted">載入失敗</p>'; }
}

async function loadDeals() {
    const dealContainer = document.getElementById('cartItems');
    try {
        const res = await fetch('/api/read/getAllDeals');
        const deals = await res.json();
        if (!deals || deals.length === 0) { dealContainer.innerHTML = '<div class="col-12 empty-msg">尚無歷史訂單</div>'; return; }
        
        dealContainer.innerHTML = '';
        deals.forEach(deal => {
            const item = deal.auctionItem?.[0] || { title: deal.title || 'Item', images: deal.image };
            let imgSrc = Array.isArray(item.images) ? item.images[0] : (item.images || deal.image || '/Image/default-item.jpg');
            
            const div = document.createElement('div');
            div.className = 'col-md-4 col-sm-6';
            div.innerHTML = `
                <div class="card bg-light" style="width: 100%; opacity: 0.85; margin-bottom: 20px;">
                    <img class="card-img-top" src="${imgSrc}" style="height: 150px; object-fit: cover; filter: grayscale(80%);" onerror="this.src='/Image/default-item.jpg'">
                    <div class="card-body">
                        <h5 class="card-title text-muted">${item.title} (已購買)</h5>
                        <p class="card-text">成交價: $${deal.total_price || deal.totalAmount}<br>日期: ${new Date(deal.purchaseDate || deal.dealDate).toLocaleDateString()}</p>
                    </div>
                </div>`;
            dealContainer.appendChild(div);
        });
    } catch (e) { dealContainer.innerHTML = '<p class="col-12 text-center text-muted">載入失敗</p>'; }
}

document.addEventListener('DOMContentLoaded', () => { loadCart(); loadBids(); loadDeals(); });
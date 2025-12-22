import * as sideBar from './sideBar.js';

// 載入側邊欄
fetch('sideBar.html')
  .then(res => res.text())
  .then(html => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.innerHTML = html;
      const links = sidebar.querySelectorAll('a.nav-item');
      const currentPage = location.pathname.split('/').pop() || 'auction_item.html';
      links.forEach(link => {
        if (link.getAttribute('href') === currentPage) link.classList.add('active');
      });
      sideBar.collapse();
    }
  });

// 取得 URL 參數
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');
if (!itemId) {
  alert('找不到商品');
  location.href = 'homePage.html';
}

let itemData = null;
let timer = null;

const elements = {
  mainImage: document.getElementById('mainImage'),
  gallery: document.getElementById('gallery'),
  itemTitle: document.getElementById('itemTitle'),
  itemDesc: document.getElementById('itemDesc'),
  sellerName: document.getElementById('sellerName'),
  startBid: document.getElementById('startBid'),
  highestBid: document.getElementById('highestBid'),
  timeRemaining: document.getElementById('timeRemaining'),
  bidAmount: document.getElementById('bidAmount'),
  placeBidBtn: document.getElementById('placeBidBtn'),
  bidNotice: document.getElementById('bidNotice')
};

// 載入商品詳細資料
async function loadItem() {
  try {
    const res = await fetch(`/api/data/auctions/${itemId}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message || 'Loading failed');

    itemData = data.item;
    //compare current session to check if the user is the owner
    let session = null;
    try {
      const sres = await fetch('/api/info/session', { method: 'POST', credentials: 'include' });
      if (sres.ok) session = await sres.json();
    } catch (e) {
      session = null;
    }
    const isOwner = !!(session && session.id && session.id === itemData.sellerId);


    // 賣家名稱（從 Users 拿
    const userRes = await fetch(`/api/read/getUserfromID/${itemData.sellerId}`);

    if (userRes.ok) {
        const userData = await userRes.json();
        elements.sellerName.textContent = userData.name || 'Anonymous';
    } else {
        elements.sellerName.textContent = 'Unknown seller';
    }

    // 圖片
    if (itemData.images && itemData.images.length > 0) {
        elements.mainImage.src = itemData.images[0];
        itemData.images.forEach((img, i) => {
            const thumb = document.createElement('img');
            thumb.src = img;
            thumb.className = 'thumb';
            if (i === 0) thumb.classList.add('active');
            thumb.onclick = () => {
                elements.mainImage.src = img;
                document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            };
            elements.gallery.appendChild(thumb);
        });
    } else {
        elements.mainImage.src = '/Image/default-item.jpg';
    }

    elements.itemTitle.textContent = itemData.title;
    elements.itemDesc.textContent = itemData.description || 'No Description';

    if (isOwner) {
      if (elements.placeBidBtn) elements.placeBidBtn.disabled = true;
      if (elements.bidAmount) {
        elements.bidAmount.disabled = true;
      }
      if (elements.bidNotice) {
        elements.bidNotice.textContent = 'You cannot bid on your own item.';
        elements.bidNotice.style.color = '#e63946';
        elements.bidNotice.style.fontWeight = '600';
        elements.bidNotice.style.display = 'block';
      }
    }

    if(itemData.dSale){
        dSaleItems(itemData, isOwner); // 傳入 isOwner
        return;
    }
    // 基本資訊
    elements.startBid.textContent = `NT$${itemData.startPrice}`;
    elements.highestBid.textContent = `NT$${itemData.currentPrice}`;
    elements.bidAmount.min = itemData.currentPrice + 10;
    elements.bidAmount.value = itemData.currentPrice + 10;

    // 開始倒數
    startCountdown(itemData.endTime);

  } catch (err) {
    console.error(err);
    elements.itemTitle.textContent = 'Product loading failed.';
  }
}

// 倒數計時
function startCountdown(endTimeStr) {
  const endTime = new Date(endTimeStr).getTime();

  timer = setInterval(() => {
    const now = new Date().getTime();
    const diff = endTime - now;

    if (diff <= 0) {
      elements.timeRemaining.textContent = 'The auction has ended.';
      elements.timeRemaining.style.color = '#e63946';
      elements.placeBidBtn.disabled = true;
      clearInterval(timer);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let text = '';
    if (days > 0) text += `${days}D `;
    if (hours > 0) text += `${hours}H `;
    text += `${minutes}M ${seconds}S`;

    elements.timeRemaining.textContent = text;

    // 最後 10 分鐘變橘色
    if (diff < 10 * 60 * 1000) {
      elements.timeRemaining.style.color = '#ff8c00';
    }
  }, 1000);
}

// 出價 (拍賣模式)
elements.placeBidBtn.addEventListener('click', async () => {
    const bidValue = elements.bidAmount.value.trim();
    if (!bidValue || isNaN(bidValue) || Number(bidValue) <= 0) {
        elements.bidNotice.textContent = 'Please enter valid amount.';
        elements.bidNotice.style.color = '#e63946';
        return;
    }

    const bid = Number(bidValue);

    try {
        const res = await fetch(`/api/data/auctions/${itemId}/bid`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: bid })
        });

        const result = await res.json();

        if (result.success) {
            // 立即更新畫面
            itemData.currentPrice = result.newPrice || bid;
            elements.highestBid.textContent = `NT$${itemData.currentPrice}`;
            elements.bidAmount.value = itemData.currentPrice + 10;
            elements.bidAmount.min = itemData.currentPrice + 10;

            elements.bidNotice.textContent = result.message || 'Bid successful！';
            elements.bidNotice.style.color = '#007b00';
        } else {
            elements.bidNotice.textContent = result.message;
            elements.bidNotice.style.color = '#e63946';
        }
    } catch (err) {
        elements.bidNotice.textContent = 'Network error, please try again.';
        elements.bidNotice.style.color = '#e63946';
    }
});
// 啟動
document.addEventListener('DOMContentLoaded', loadItem);

// === 關鍵修改：直購模式處理 ===
function dSaleItems(itemData, isOwner) {
    document.getElementById("blah").innerHTML = `
        <div class="info-box">
            <div class="info-label">Quantity</div>
            <div class="info-value" id="quantity">0</div>
        </div>
        <div class="info-box">
            <div class="info-label">Price</div>
            <div class="info-value" id="price" style="font-weight:bold; color:#e63946;">NT$0</div>
        </div>
    `;
    document.getElementById("quantity").textContent = itemData.stock + ' left';
    document.getElementById("price").textContent = `NT$${itemData.price || itemData.buyNowPrice}`; // 相容性修正

    if (isOwner) {
        document.getElementById("bidSection").innerHTML = `
        <div class="info-warning" style="color:#e63946; font-weight:600;">You cannot buy your own item.</div>
        `;
        return;
    }

    if(itemData.stock <= 0){
        document.getElementById("bidSection").innerHTML = `<div style="color:red; font-weight:bold;">Sold out</div>`;
    } else {
        // 因為我們是 "Buy Now" 跳轉結帳，通常數量固定為 1，或者你可以保留數量選擇
        // 這裡為了配合你的後端 /api/auction/buy-now，我們簡化為直接購買
        document.getElementById("bidSection").innerHTML = `
        <button id="buyBtn" class='btn' style="width:100%; background-color:#28a745; color:white;">立即購買 (Buy Now)</button>
        `;
        
        document.getElementById("buyBtn").addEventListener('click', async () => {
            if(!confirm('確定要立即購買此商品嗎？將前往結帳頁面。')) return;

            try {
                // 呼叫我們新寫的後端 API
                const res = await fetch('/api/auction/buy-now', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ itemId: itemData._id }) // 傳 itemId
                });

                const result = await res.json();
                
                if (res.ok && result.success) {
                    alert('商品已鎖定，正在前往安全結帳頁面...');
                    // === 成功跳轉 ===
                    window.location.href = '/checkout.html';
                } else {
                    alert(result.error || result.message || '購買失敗');
                    if(result.error && result.error.includes('登入')) {
                         window.location.href = '/login.html';
                    }
                }
            } catch(err) {
                console.error(err);
                alert('網路錯誤，請稍後再試。');
            }
        });
    }
}
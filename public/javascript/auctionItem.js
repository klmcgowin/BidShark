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
    
    // 檢查 Session (確認是否為擁有者)
    let session = null;
    try {
      const sres = await fetch('/api/info/session', { method: 'POST', credentials: 'include' });
      if (sres.ok) session = await sres.json();
    } catch (e) {
      session = null;
    }
    const isOwner = !!(session && session.id && session.id === itemData.sellerId);

    // 賣家名稱
    try {
        const userRes = await fetch(`/api/read/getUserfromID/${itemData.sellerId}`);
        if (userRes.ok) {
            const userData = await userRes.json();
            elements.sellerName.textContent = userData.name || 'Anonymous';
        } else {
            elements.sellerName.textContent = 'Unknown seller';
        }
    } catch (e) {
        elements.sellerName.textContent = 'Unknown seller';
    }

    // 圖片處理
    if (itemData.images && itemData.images.length > 0) {
        elements.mainImage.src = itemData.images[0];
        
        // 清空 Gallery 防止重複
        elements.gallery.innerHTML = '';
        
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

    // 擁有者權限控制
    if (isOwner) {
      if (elements.placeBidBtn) elements.placeBidBtn.disabled = true;
      if (elements.bidAmount) elements.bidAmount.disabled = true;
      if (elements.bidNotice) {
        elements.bidNotice.textContent = 'You cannot bid on your own item.';
        elements.bidNotice.style.color = '#e63946';
        elements.bidNotice.style.display = 'block';
      }
    }

    // 分流處理：直購 vs 拍賣
    if(itemData.dSale){
        dSaleItems(itemData, isOwner); 
        return;
    }

    // --- 以下為拍賣模式 ---
    elements.startBid.textContent = `NT$${itemData.startPrice}`;
    elements.highestBid.textContent = `NT$${itemData.currentPrice}`;
    
    // 設定出價輸入框
    const minBid = itemData.currentPrice + 1; // 至少加 1 元
    elements.bidAmount.min = minBid;
    elements.bidAmount.value = minBid;

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

    if (diff < 10 * 60 * 1000) {
      elements.timeRemaining.style.color = '#ff8c00';
    }
  }, 1000);
}

// 拍賣出價監聽
if (elements.placeBidBtn) {
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
                itemData.currentPrice = result.newPrice || bid;
                elements.highestBid.textContent = `NT$${itemData.currentPrice}`;
                elements.bidAmount.value = itemData.currentPrice + 1;
                elements.bidAmount.min = itemData.currentPrice + 1;

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
}

document.addEventListener('DOMContentLoaded', loadItem);

// ===========================================
//  直購模式處理 (Direct Sale Logic)
// ===========================================
function dSaleItems(itemData, isOwner) {
    // 1. 隱藏拍賣特有的區塊，顯示直購資訊
    document.getElementById("blah").innerHTML = `
        <div class="info-box">
            <div class="info-label">Stock</div>
            <div class="info-value" id="quantity">${itemData.stock}</div>
        </div>
        <div class="info-box">
            <div class="info-label">Price</div>
            <div class="info-value" id="price" style="font-weight:bold; color:#e63946;">NT$${itemData.price}</div>
        </div>
    `;

    const bidSection = document.getElementById("bidSection");

    // 2. 如果是賣家自己
    if (isOwner) {
        bidSection.innerHTML = `
            <div class="info-warning" style="color:#e63946; font-weight:600; padding:10px;">
                You cannot buy your own item.
            </div>
        `;
        return;
    }

    // 3. 如果沒庫存
    if (itemData.stock <= 0) {
        bidSection.innerHTML = `<div style="color:red; font-weight:bold; padding:10px;">Sold out</div>`;
        return;
    } 
    
    // 4. 有庫存 -> 顯示數量輸入框 + 購買按鈕
    // 恢復輸入數量的功能
    bidSection.innerHTML = `
        <div style="display: flex; gap: 10px; width: 100%; align-items: center;">
            <input type="number" id="buyAmount" class="inputBox" 
                   value="1" min="1" max="${itemData.stock}" 
                   style="width: 80px; padding: 10px;">
            <button id="buyBtn" class='btn' style="flex: 1; background-color:#28a745; color:white;">加入購物車 (Add to Cart)</button>
        </div>
        <div id="buyNotice" class="notice" style="margin-top: 5px;"></div>
    `;
    
    // 綁定購買按鈕事件
    document.getElementById("buyBtn").addEventListener('click', async () => {
        const amtInput = document.getElementById("buyAmount");
        const amount = parseInt(amtInput.value, 10);
        const notice = document.getElementById("buyNotice");

        // 驗證數量
        if (!amount || amount < 1 || amount > itemData.stock) {
            alert(`請輸入有效的購買數量 (1 - ${itemData.stock})`);
            return;
        }

        if (!confirm(`確定要將 ${amount} 件商品加入購物車嗎？`)) return;

        try {
            // 對應 dataManipulation.ts 的路由: /auctions/:id/buy/:amt
            const res = await fetch(`/api/data/auctions/${itemData._id}/buy/${amount}`, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'}
            });

            const result = await res.json();
            
            if (res.ok && result.success) {
                alert('🎉 加入購物車成功！請前往購物車結帳。');
                // 可選擇重新整理或跳轉購物車
                // window.location.reload(); 
                window.location.href = 'cart.html';
            } else {
                notice.textContent = result.error || result.message || '購買失敗';
                notice.style.color = 'red';
                
                if (res.status === 401) {
                    alert("請先登入");
                    window.location.href = 'login.html';
                }
            }
        } catch(err) {
            console.error(err);
            alert('網路錯誤，請稍後再試。');
        }
    });
}
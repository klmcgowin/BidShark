import * as sideBar from './sideBar.js';

fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = html;
            const links = sidebar.querySelectorAll('a.nav-item');
            const currentPage = window.location.pathname.split('/').pop();
            links.forEach(link => {
                if (link.getAttribute('href') === currentPage) {
                    link.classList.add('active');
                }
            });
            sideBar.collapse();
        }
    });

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadMyItems() {
    try {
        const res = await fetch('/api/data/myItems', { credentials: 'include' });
        // debug
        console.log('/api/myItems status:', res.status, 'content-type:', res.headers.get('content-type'));
        const text = await res.text();
        // if not JSON, log body and throw
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            console.error('Non-JSON response for /api/myItems:', text);
            // debug
            document.getElementById('productContainer').innerText = 'Server returned non-JSON response. See console.';
            return;
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            console.error('Failed to parse /api/myItems JSON:', parseErr, 'raw body:', text);
            document.getElementById('productContainer').innerText = 'Invalid JSON from server. See console.';
            return;
        }

        const container = document.getElementById('productContainer');
        container.innerHTML = '';

        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
            container.innerHTML = '<p>No items found.</p>';
            return;
        }

        data.items.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('item-card');
            const imgSrc = item.image || '/Image/default-item.jpg';

            // === 1. 狀態翻譯邏輯 ===
            let statusLabel = item.status;
            let statusClass = 'status-default';

            switch (item.status) {
                case 'active':
                    statusLabel = 'Active';
                    statusClass = 'status-active';
                    break;
                case 'inactive':
                    statusLabel = 'Ended'; 
                    statusClass = 'status-sold';
                    break;
                case 'unsold':
                    statusLabel = 'Unsold';
                    statusClass = 'status-fail';
                    break;
                case 'unsold_reserve_not_met':
                    statusLabel = 'Reserve Not Met';
                    statusClass = 'status-fail';
                    break;
                default:
                    statusLabel = escapeHtml(item.status);
            }

            card.innerHTML = `
                <div class="item-content">
                    <div class="item-image-wrap">
                        <img src="${imgSrc}" alt="${escapeHtml(item.title)}" class="item-img"/>
                    </div>
                    
                    <div class="item-details">
                        <div class="item-name">${escapeHtml(item.title)}</div>
                        
                        <!-- Metadata 區塊：標籤 + 狀態文字 -->
                        <div class="item-meta">
                            ${item.dSale 
                                ? `<span class="badge badge-direct">Direct</span>` 
                                : `<span class="badge badge-auction">Auction</span>`
                            }
                            <!-- 顯示翻譯後的狀態文字 -->
                            <span class="status-text ${statusClass}">${statusLabel}</span>
                        </div>
                    </div>

                    <div class="item-actions">
                        <div class="item-price">NTD ${Number(item.price).toLocaleString()}</div>
                        <div class="item-time">${item.dSale ? `Stock: ${item.stock ?? 0}` : (item.timeLeft || '')}</div>
                    </div>
                </div>
            `;
            // === 判斷狀態是否允許跳轉 === 
             if (statusClass === 'status-fail' || statusClass === 'status-sold') {
                // 1. 設定滑鼠游標為預設 (不是手指形狀)
                card.style.cursor = 'default';
                
                // 2. (選用) 可以稍微降低透明度，讓它看起來像無效狀態
                card.style.opacity = '0.7'; 
            } else {
                // 只有狀態不是 fail 時，才允許點擊跳轉
                card.addEventListener('click', () => {
                    window.location.href = `editItem.html?id=${item._id}`;
                });
            }
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading items:", err);
        document.getElementById('productContainer').innerText = 'Error loading items. See console.';
    }
}

loadMyItems();
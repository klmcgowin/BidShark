const tabs = document.querySelectorAll('.tab');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});


const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});

// 商品卡片點擊
const itemCards = document.querySelectorAll('.item-card, .more-card');
itemCards.forEach(card => {
    card.addEventListener('click', () => {
        alert('商品詳情頁面開發中！');
    });
});

// Search 按鈕
document.querySelector('.search-btn').addEventListener('click', () => {
    const searchQuery = prompt('請輸入搜尋關鍵字：');
    if (searchQuery) {
        alert(`搜尋功能開發中！\n您搜尋的是：${searchQuery}`);
    }
});

// Filter 按鈕
document.querySelector('.filter-btn').addEventListener('click', () => {
    alert('篩選功能開發中！\n即將推出：\n- 價格範圍\n- 分類篩選\n- 結束時間\n- 商品狀態');
});
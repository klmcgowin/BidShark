import * as sideBar from './sideBar.js';
fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        sidebar.innerHTML = html;
        const links = sidebar.querySelectorAll('a.nav-item');
        const currentPage = window.location.pathname.split('/').pop();
        links.forEach(link => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage) {
                link.classList.add('active');
            }
        });
        sideBar.collapse();
    });
const deals = [];

async function dealData() {
    const res = await fetch('api/read/getAllDeals');
    const v = await res.json();
    v.forEach((item) => {
        deals.push(item)
    });

}

(function(){
    dealData().then(() => {
        const dealContainer = document.getElementById('cartItems');
        deals.forEach(deal => {
            const dealElement = document.createElement('div');
            dealElement.classList.add('card');
            dealElement.style.width = '13rem';
            const item = deal.auctionItem?.[0] || {};
            dealElement.innerHTML = `
                <img class="card-img-top" src="${item.images || '/Image/default-item.jpg'}" alt="Card image cap">
                <div class="card-body">
                    <h5 class="card-title">${item.title}</h5>
                    <p class="card-text">
                        ${deal.quantity} items * ${deal.individual_price} TWD =
                        ${deal.total_price} TWD
                    </p>
                </div>
            `;
            dealContainer.appendChild(dealElement);
        });
    });
})();
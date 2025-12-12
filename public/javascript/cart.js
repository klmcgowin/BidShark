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
const bids = [];
async function dealData() {
    const res = await fetch('api/read/getAllDeals');
    const v = await res.json();
    v.forEach((item) => {
        deals.push(item)
    });

}
async function bidData() {
    const res = await fetch('api/read/getAllBid');
    const v = await res.json();
    v.forEach((item) => {
        bids.push(item)
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
    bidData().then(() => {
        const bidContainer = document.getElementById('bidItems');
        bids.forEach(bid => {
            const item = bid.auctionItem?.[0] || {};
            if(item.status === 'inactive') return;
            const bidElement = document.createElement('div');
            bidElement.classList.add('card');
            bidElement.style.width = '13rem';
            bidElement.innerHTML = `
                <img class="card-img-top" src="${item.images || '/Image/default-item.jpg'}" alt="Card image cap">
                <div class="card-body">
                    <h5 class="card-title">${item.title}</h5>
                    <p class="card-text">
                        Current Highest Bid: ${item.currentPrice} TWD
                        <br>
                        Your Bid: ${bid.price} TWD
                        <br>
                        Time Left: <span class="countdown" data-endtime="${item.endTime}" style= 'color:red' ></span>
                    </p>
                </div>
            `;
            bidContainer.appendChild(bidElement);
            (function(el, endTimeStr){
                const span = el.querySelector('.countdown');
                let timer;
                function update(){
                    const now = new Date();
                    const end = new Date(endTimeStr);
                    let diff = Math.max(0, end - now);
                    if(diff <= 0){
                        span.textContent = 'Ended';
                        clearInterval(timer);
                        return;
                    }
                    const days = Math.floor(diff / 86400000);
                    diff %= 86400000;
                    const hours = Math.floor(diff / 3600000);
                    diff %= 3600000;
                    const minutes = Math.floor(diff / 60000);
                    diff %= 60000;
                    const seconds = Math.floor(diff / 1000);
                    span.textContent = (days ? days + 'd ' : '') +
                        String(hours).padStart(2,'0') + ':' +
                        String(minutes).padStart(2,'0') + ':' +
                        String(seconds).padStart(2,'0');
                }
                update();
                timer = setInterval(update, 1000);
            })(bidElement, item.endTime);
        });
    });
})();

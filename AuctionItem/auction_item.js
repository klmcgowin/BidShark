document.addEventListener("DOMContentLoaded", () => {
  const bidInput = document.getElementById("bidAmount");
  const placeBidBtn = document.getElementById("placeBidBtn");
  const highestBidDisplay = document.getElementById("highestBid");
  const notice = document.getElementById("bidNotice");
  const buyoutBtn = document.getElementById("buyoutBtn");
  const timeRemainingDisplay = document.getElementById("timeRemaining");

  let highestBid = parseInt(
    highestBidDisplay.textContent.replace(/[^0-9]/g, "")
  );
  if (isNaN(highestBid)) highestBid = 0; // 預防讀取錯誤

  // 假設從後端拿到的結束時間
  const auctionEndTime = new Date("2025-12-31T23:59:59");

  function updateCountdown() {
    const now = new Date();
    const diff = auctionEndTime - now;

    if (diff <= 0) {
      timeRemainingDisplay.textContent = "Auction Ended";
      timeRemainingDisplay.style.color = "#e63946";
      clearInterval(timer);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    // 即將結束 < 10 minutes → 顯示橘色警告
    if (diff < 10 * 60 * 1000) {
      timeRemainingDisplay.style.color = "#ff8c00";
    } else {
      timeRemainingDisplay.style.color = "#000";
    }

    let result = "";

    if (days > 0) result += `${days}d `;
    result += `${hours}h ${minutes}m`;

    timeRemainingDisplay.textContent = result.trim();
  }

  const timer = setInterval(updateCountdown, 500); // 每 0.5 秒更新
  updateCountdown(); // 初次執行立即顯示

  // 點擊出價按鈕
  placeBidBtn.addEventListener("click", () => {
    const bid = parseInt(bidInput.value);

    if (isNaN(bid)) {
      notice.textContent = "Please enter a valid number!";
      notice.style.color = "#e63946";
      return;
    }

    if (bid > highestBid) {
      highestBid = bid;
      highestBidDisplay.textContent = `$${highestBid.toLocaleString()}`;
      notice.textContent = "Bid placed successfully!";
      notice.style.color = "#007b00";
    } else {
      notice.textContent = "Your bid must be higher than the current highest bid!";
      notice.style.color = "#e63946";
    }
  });

  // 點擊立即購買按鈕
  buyoutBtn.addEventListener("click", () => {
    notice.textContent = "🎉 Congratulations! You bought this item instantly!";
    notice.style.color = "#007b00";
  });
});

import * as sideBar from "./sideBar.js";

let currentChatId = null;
let currentSubject = null;
let currentWithUser = null;

// 載入 Sidebar
fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = html;
            const links = sidebar.querySelectorAll('a.nav-item');
            const currentPage = location.pathname.split('/').pop() || 'homePage.html';
            links.forEach(link => {
                if (link.getAttribute('href') === currentPage) {
                    link.classList.add('active');
                }
            });
            sideBar.collapse();
        }
    });

// 載入聊天列表 (包含未讀紅點邏輯)
async function loadChats() {
    try {
        const chats = await fetch('/api/chat/getYourChats'); // 確保後端回傳 unreadCount
        const cCont = document.getElementById('chatContainer');
        
        if (chats.ok) {
            const data = await chats.json();
            
            // 如果目前沒有選中任何聊天，或者資料變動了，才更新 DOM (簡單的優化)
            // 為了簡化，這裡還是每次重繪，但加入了保留 scroll 位置
            // const oldScroll = cCont.scrollTop; 
            
            if (data.length === 0) {
                cCont.innerHTML = '<p class="text-center mt-3 text-muted">No chats found.</p>';
                return;
            }
            
            cCont.innerHTML = '';
            
            data.forEach(chat => {
                const chatBtn = document.createElement('button');
                
                // 基本樣式 + Flexbox 排版
                chatBtn.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
                
                // 標題與對方名稱
                let htmlContent = `
                    <div class="text-truncate">
                        ${chat.OnSubject} 
                        <small class="text-muted ms-1">(@${chat.withUser})</small>
                    </div>
                `;

                // 🔥【新增】未讀紅點邏輯
                // 如果是當前正在看的聊天室，就不顯示紅點 (視為已讀)
                const isCurrentChat = currentChatId === chat.chatId;
                
                if (chat.unreadCount > 0 && !isCurrentChat) {
                    htmlContent += `<span class="badge bg-danger rounded-pill">${chat.unreadCount}</span>`;
                    chatBtn.classList.add("fw-bold"); // 未讀時文字加粗
                }

                chatBtn.innerHTML = htmlContent;
                chatBtn.value = chat.chatId;

                // 保持選中狀態的高亮
                if (isCurrentChat) {
                    chatBtn.classList.add('active');
                }

                chatBtn.onclick = () => {
                    // 點擊時立即移除視覺上的紅點
                    const badge = chatBtn.querySelector('.badge');
                    if(badge) badge.remove();
                    chatBtn.classList.remove("fw-bold");
                    
                    // 移除其他按鈕的 active
                    document.querySelectorAll('#chatContainer .list-group-item').forEach(b => b.classList.remove('active'));
                    chatBtn.classList.add('active');

                    getMessages(chat.chatId, chat.OnSubject, chat.withUser);
                }
                cCont.appendChild(chatBtn);
            });
            
            // cCont.scrollTop = oldScroll;
        }
    } catch (e) {
        console.error("Load chats error:", e);
    }
}

// 取得訊息並標記為已讀
async function getMessages(chatId, subject, withUser) {
    // 1. 呼叫 API 取得訊息
    const response = await fetch(`/api/chat/getChat/${chatId}`);
    
    currentChatId = chatId;
    currentSubject = subject;
    currentWithUser = withUser;
    
    // UI 更新
    const messagesArea = document.getElementById('messagesArea');
    document.getElementById('chatIdInput').value = chatId;
    document.getElementById("noChatSelected").classList.add('d-none'); // 隱藏 "請選擇聊天"
    document.getElementById("chatContent").classList.remove('d-none'); // 顯示聊天內容
    document.getElementById("recipientName").textContent = withUser;
    document.getElementById("subjectTitle").textContent = subject;

    // 🔥【新增】呼叫後端標記為已讀
    fetch('/api/chat/markAsRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatId })
    }).catch(err => console.error("Mark read failed", err));

    if (response.ok) {
        const data = await response.json();

        messagesArea.innerHTML = '';

        if (data.length === 0) {
            messagesArea.innerHTML = '<p class="text-center text-muted mt-5">Start the conversation!</p>';
            return;
        }

        data.forEach(msg => {
            const isUser = msg.speaker === 'You';
            const messageWrapper = document.createElement('div');
            messageWrapper.className = `d-flex mb-2 ${isUser ? 'justify-content-end' : 'justify-content-start'}`;
            
            const messageBubble = document.createElement('div');
            // 加入 message class 以配合 CSS Dark Mode
            messageBubble.className = `message p-2 rounded-3 text-break shadow-sm ${isUser ? 'sent bg-primary text-white' : 'received bg-light text-dark border'}`;
            
            if (!isUser) {
                messageBubble.innerHTML = `<small class="text-muted d-block" style="font-size:0.75rem">${msg.speaker}</small>`;
            }
            messageBubble.innerHTML += `<p class="mb-0">${msg.message}</p>`;
            
            messageWrapper.appendChild(messageBubble);
            messagesArea.appendChild(messageWrapper);
        });
        
        // 捲動到底部
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } else {
        messagesArea.innerHTML = '<p class="text-danger text-center mt-5">Failed to load chat messages.</p>';
        console.error('Error loading chat:', response.status);
    }
}

// 發送訊息
async function sendMessage() {
    const input = document.getElementById("messageInput");
    const msg = input.value.trim();
    const chatId = document.getElementById('chatIdInput').value;

    if (msg === '') return;

    // 立即清空輸入框，提升體驗
    input.value = '';

    const res = await fetch(`/api/chat/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: msg,
            chatId: chatId
        })
    });

    if (res.ok) {
        await reloadMessages(true); // true 表示強制捲動到底部
    } else {
        console.error('Error sending message:', res.status);
        alert("Send failed");
    }
}

// 綁定發送按鈕
document.getElementById("submit").addEventListener('click', async e => {
    sendMessage();
});

// 綁定 Enter 鍵
document.getElementById('messageInput').addEventListener('keydown', async e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await sendMessage();
    }
});

// 定期更新訊息 (Polling)
async function reloadMessages(forceScroll = false) {
    if (!currentChatId) return;
    
    const ChatIdChecker = currentChatId;
    const response = await fetch(`/api/chat/getChat/${currentChatId}`);
    const messagesArea = document.getElementById('messagesArea');
    
    // 記錄當前捲動位置，以便更新後維持位置 (除非 forceScroll)
    const oldScrollPosition = messagesArea.scrollTop;
    const isAtBottom = messagesArea.scrollHeight - messagesArea.scrollTop === messagesArea.clientHeight;

    if (!response.ok) return;

    const data = await response.json();
    
    // 防止 Race Condition (如果使用者已經切換到別的聊天室)
    if (currentChatId !== ChatIdChecker) return;
    
    messagesArea.innerHTML = '';

    if (data.length === 0) {
        messagesArea.innerHTML = '<p class="text-center text-muted mt-5">Start the conversation!</p>';
        return;
    }

    data.forEach(msg => {
        const isUser = msg.speaker === 'You';
        const wrapper = document.createElement('div');
        wrapper.className = `d-flex mb-2 ${isUser ? 'justify-content-end' : 'justify-content-start'}`;

        const bubble = document.createElement('div');
        bubble.className = `message p-2 rounded-3 text-break shadow-sm ${isUser ? 'sent bg-primary text-white' : 'received bg-light text-dark border'}`;

        if (!isUser) {
            bubble.innerHTML = `<small class="text-muted d-block" style="font-size:0.75rem">${msg.speaker}</small>`;
        }

        bubble.innerHTML += `<p class="mb-0">${msg.message}</p>`;
        wrapper.appendChild(bubble);
        messagesArea.appendChild(wrapper);
    });

    // 如果原本就在底部，或者剛發送完訊息，就捲動到底部
    if (forceScroll || isAtBottom) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    } else {
        messagesArea.scrollTop = oldScrollPosition;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', loadChats);

// ----- mobile list toggle (保持不變) -----
(function mobileChatToggle() {
    const body = document.body;
    const mq = window.matchMedia('(max-width:900px)'); // 配合你的 CSS 900px
    let overlay = null;
    let toggle = null;
    const listSelector = '.chat-list-container';

    function createOverlay() {
        overlay = document.querySelector('.chat-list-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'chat-list-overlay';
            document.body.appendChild(overlay);
        }
    }
    function createToggle() {
        if (document.querySelector('.mobile-chat-toggle')) return;
        createOverlay();
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-chat-toggle';
        toggle.setAttribute('aria-label', 'Open chats');
        // SVG Icon
        toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 00-2 2v14l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zM6 9h12v2H6V9zm0-3h12v2H6V6z"/></svg>';
        document.body.appendChild(toggle);

        const list = document.querySelector(listSelector);
        function closeList() { list?.classList.remove('show'); overlay.classList.remove('show'); }
        function openList() { list?.classList.add('show'); overlay.classList.add('show'); }

        toggle.addEventListener('click', () => {
            if (!list) return;
            if (list.classList.contains('show')) closeList(); else openList();
        });
        overlay.addEventListener('click', closeList);

        // close list when selecting a chat
        setTimeout(() => {
            // 使用事件委派 (Event Delegation) 處理動態生成的按鈕
            document.getElementById('chatContainer').addEventListener('click', (e) => {
                if (mq.matches && e.target.closest('button')) {
                    closeList();
                }
            });
        }, 600);
    }
    function removeToggle() {
        const t = document.querySelector('.mobile-chat-toggle');
        const o = document.querySelector('.chat-list-overlay');
        const list = document.querySelector(listSelector);
        if (t) t.remove();
        if (o) o.remove();
        if (list) list.classList.remove('show');
    }

    function handleMqChange(e) {
        if (e.matches) createToggle(); else removeToggle();
    }
    mq.addEventListener('change', handleMqChange);
    if (mq.matches) createToggle();
})();

// Polling 機制
(function(){
    // 每 3 秒重新讀取列表 (包含未讀紅點更新)
    setInterval(loadChats, 3000);
    
    // 每 1 秒更新對話內容
    setInterval(() => reloadMessages(false), 1000);
})();
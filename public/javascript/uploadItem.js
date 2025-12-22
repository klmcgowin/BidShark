import * as sideBar from './sideBar.js';
// 引入 browser-image-compression 套件
import imageCompression from 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.mjs';

fetch('sideBar.html')
    .then(res => res.text())
    .then(html => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.innerHTML = html;
            const links = sidebar.querySelectorAll('a.nav-item');
            const currentPage = window.location.pathname.split('/').pop() || 'uploadItem.html';
            links.forEach(link => {
                if (link.getAttribute('href') === currentPage) {
                    link.classList.add('active');
                }
            });
            sideBar.collapse();
        }
    });

document.addEventListener('DOMContentLoaded', function () {
    const uploadForm = document.getElementById('itemUploadForm');
    const fileInput = document.getElementById('itemImage');
    const uploadLabel = document.querySelector('.file-upload-label');

    // 圖片預覽
    fileInput?.addEventListener('change', () => {
        if (!uploadLabel) return;
        uploadLabel.querySelectorAll('.preview').forEach(el => el.remove());

        const files = fileInput.files;
        if (files.length > 5) {
            alert('You can only upload maximum 5 pictures.');
            fileInput.value = '';
            return;
        }

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const div = document.createElement('div');
                div.className = 'preview';
                div.style.cssText = 'display:inline-block;margin:5px;position:relative;';
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width:90px;height:90px;object-fit:cover;border-radius:8px;';
                div.appendChild(img);
                uploadLabel.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    });

    // 表單提交 
    uploadForm?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const files = fileInput.files;
        // 1. 檢查是否有檔案
        if (files.length === 0) {
            alert('Please select at least one image.');
            return;
        }

        const submitBtn = document.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Compressing & Uploading...';
        }

        const formData = new FormData(uploadForm);
        
        // 移除原本的未壓縮檔案
        formData.delete('itemImage'); 

        const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1280,
            useWebWorker: true,
            fileType: 'image/jpeg'
        };

        try {
            // 2. 壓縮圖片
            const compressPromises = Array.from(files).map(async (originalFile) => {
                // 如果不是圖片，回傳原檔
                if (!originalFile.type.startsWith('image/')) return originalFile;
                
                try {
                    console.log(`Compressing ${originalFile.name}...`);
                    const compressedBlob = await imageCompression(originalFile, options);
                    
                    // 🔥【關鍵修正】強制轉回 File 物件並保留原始檔名
                    // Multer 需要 filename 才能識別這是檔案
                    return new File([compressedBlob], originalFile.name, { 
                        type: compressedBlob.type || originalFile.type 
                    });

                } catch (error) {
                    console.error("Compression failed for", originalFile.name, error);
                    // 壓縮失敗回傳原檔
                    return originalFile; 
                }
            });

            const compressedFiles = await Promise.all(compressPromises);

            // 3. 將帶有檔名的檔案加回 FormData
            compressedFiles.forEach(file => {
                formData.append('itemImage', file);
            });

            // 4. 發送請求
            const response = await fetch('/api/data/auctions/create', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert('Auction item uploaded successfully!');
                uploadForm.reset();
                if (uploadLabel) {
                    uploadLabel.querySelectorAll('.preview').forEach(el => el.remove());
                }
                window.location.href = '/myItem.html';
            } else {
                alert('Upload Failed: ' + result.message);
            }
        } catch (err) {
            console.error(err);
            alert('Network error or compression error. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                const isDirect = document.getElementById('modeSwitch').checked;
                submitBtn.textContent = isDirect ? 'Start Sale' : 'Start Auction';
            }
        }
    });
});

// 切換拍賣/直購模式的 HTML 
const auctionHTML = `
    <h2 class="section-title">Auction Details</h2>
    <div class="grid-2">
        <div class="input-group">
            <label for="startPrice">Starting Price (NTD)</label>
            <input type="number" id="startPrice" name="startPrice" placeholder="e.g.: 100" min="1" step="1" required>
        </div>
        <div class="input-group">
            <label for="reservePrice">Reserve Price (Optional) (NTD)</label>
            <input type="number" id="reservePrice" name="reservePrice" placeholder="e.g.: 500" min="1" step="1">
        </div>
    </div>
    <div class="input-group">
        <label for="duration">Auction Duration (Days)</label>
        <input type="number" id="duration" name="duration" placeholder="e.g.: 7" min="1" max="30" required>
    </div>
`;

const directSaleHTML = `
    <h2 class="section-title">Direct Sale Details</h2>
    <div class="grid-2">
        <div class="input-group">
            <label for="price">Price (NTD)</label>
            <input type="number" id="price" name="price" placeholder="e.g.: 100" min="1" step="1" required>
        </div>
        <div class="input-group">
            <label for="stock">Stock Quantity</label>
            <input type="number" id="stock" name="stock" placeholder="e.g.: 10" min="1" step="1" required>
        </div>
    </div>
`;

document.getElementById('modeSwitch').addEventListener('change', function (e) {
    const btn = document.getElementById('sbtn');
    if (this.checked) {
        document.getElementById('salePanel').innerHTML = directSaleHTML;
        if(btn) btn.textContent = 'Start Sale';
    } else {
        document.getElementById('salePanel').innerHTML = auctionHTML;
        if(btn) btn.textContent = 'Start Auction';
    }
});
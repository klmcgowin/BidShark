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
(async () => {
    const res = await fetch('api/info/session', {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (!data.isLoggedIn) {
        window.location.href = '../homePage.html';
    }else{
        let img = data.image.replace(/\s/g, "");
        if (img.startsWith("PHN")) {
            document.getElementById("pic").src = "data:image/svg+xml;base64," + img;
        }else{
            document.getElementById("pic").src = "data:image/png;base64," + img;
        }
        document.getElementById("nameInput").placeholder = data.name;
        document.getElementById("emailInput").placeholder = data.email;
        document.getElementById("numInput").placeholder = data.phoneNumber || "Please enter a phone number" ;
    }
})();

document.getElementById('change').addEventListener('click', async () => {
    const name = document.getElementById('nameInput').value;
    const email = document.getElementById('emailInput').value;
    const phone = document.getElementById('numInput').value;
    const res = await fetch('api/data/updateUserInfo', {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            email: email,
            phoneNumber: phone,
        })
    });

    const data = await res.json();
    if (data.status === 'success') {
        alert("Profile updated!");
        window.location.reload();
    } else {
        alert("Update failed: " + (data.error || data.message));
    }
});
document.getElementById('logout').addEventListener('click', async () => {
    let msg = await fetch('api/info/logout', {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json"}
    });
    if(msg.ok) {
        alert("Logging out")
        window.location.href = 'homePage.html'
    }else{
        let opt = await msg.json()
        alert(opt.message)
    }
})
document.getElementById('imgInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 / 1.33) {
        alert(`File too large! Max size allowed: ${(100 * 1024 / 1.33 / 1024).toFixed(1)} KB`);
        e.target.value = "";
        return;
    }
    //honestly, this is an overkill, because there is a restriction on input type but eh, better safe than sorry
    if (file.type !== "image/png") {
        alert("Invalid file type! Only PNG images are allowed.");
        e.target.value = "";
        return;
    }
    let img = await fileToBase64(file);
    img = img.replace(/^data:image\/png;base64,/, "");
    const res = await fetch('api/data/updateUserInfo', {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            picture: img
        })
    });
    const data = await res.json();
    if (data.status === 'success') {
        alert("Picture updated!");
        window.location.reload();
    } else {
        alert("Update picture failed: " + (data.error || data.message));
    }
})
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
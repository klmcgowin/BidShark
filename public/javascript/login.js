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

let isSignUpMode = true;
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

document.getElementById('toggleMode').addEventListener('click', () => {
    if (isSignUpMode) {
        document.getElementById('submitBtn').textContent = 'Sign in with email';
        document.getElementById('toggleText').firstChild.textContent = "Don't have an account? ";
        document.getElementById('toggleMode').textContent = "Sign up";
    } else {
        document.getElementById('submitBtn').textContent = 'Sign up with email';
        document.getElementById('toggleText').firstChild.textContent = "Already have an account? ";
        document.getElementById('toggleMode').textContent = "Sign in";
    }
    isSignUpMode = !isSignUpMode;
});
document.getElementById('submitBtn').addEventListener('click', () => {
    if (isSignUpMode) {
        let email = document.getElementById('emailInput').textContent;
        if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            
            fetch('api/auth/SignUp', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: document.getElementById('emailInput')})
            })
                .then(response => response.json())
                .then(data => console.log('POST Response:', data))
                .catch(err => console.error(err));
        }else{
            alert('Please enter a valid email address');
        }
    }
})
function validatePassword(password) {
    return password.length >= 6;
}


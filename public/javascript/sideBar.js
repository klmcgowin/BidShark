export function collapse(){
    document.getElementById("toggleSidebar").addEventListener('click', function () {
        if(document.querySelector(".sidebar").classList.contains('collapsed')) {
            document.querySelector(".sidebar").classList.remove('collapsed');
            document.querySelector(".toggle-btn").classList.remove('collapsed');
            document.querySelector(".everything").classList.remove('collapsed');
        }else{
            document.querySelector(".sidebar").classList.toggle("collapsed");
            document.querySelector(".toggle-btn").classList.toggle('collapsed');
            document.querySelector(".everything").classList.toggle('collapsed');
        }
    })
}
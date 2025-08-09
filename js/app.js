const burgerMenu = document.getElementById("burger-menu");
const menuItems = document.getElementById("menu-items");
const overlay = document.getElementById("menu-overlay");

if (burgerMenu && menuItems) {
  burgerMenu.addEventListener("click", () => {
    menuItems.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
  });
}

// Navigation functionality
const menuLinks = document.querySelectorAll("#menu-items a");
menuLinks.forEach(link => {
  link.addEventListener("click", () => {
    if (menuItems) menuItems.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
  });
});

// Close menu when tapping overlay
if (overlay) {
  overlay.addEventListener("click", () => {
    if (menuItems) menuItems.classList.remove("active");
    overlay.classList.remove("active");
  });
}
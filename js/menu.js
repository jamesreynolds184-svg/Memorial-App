const menuButton = document.getElementById("menu-button");
const menu = document.getElementById("burger-menu");
const menuItems = document.querySelectorAll("#burger-menu a");

menuButton.addEventListener("click", () => {
  menu.classList.toggle("open");
});

menuItems.forEach(item => {
  item.addEventListener("click", () => {
    menu.classList.remove("open");
  });
});
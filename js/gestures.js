document.addEventListener('DOMContentLoaded', function() {
    // Initialize Hammer on the document body
    const body = document.body;
    const hammer = new Hammer(body);
    
    // Configure horizontal swipe recognition
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    
    // Handle swipe left (from right to left)
    hammer.on('swipeleft', function(e) {
        // Add your swipe left behavior here if needed
    });
    
    // Handle swipe right (from left to right)
    hammer.on('swiperight', function(e) {
        // Get the current page
        const currentPath = window.location.pathname;
        const isMemorialPage = currentPath.includes('memorial.html');
        
        // If we're on memorial.html, don't go back
        if (isMemorialPage) {
            return;
        }
        
        // Otherwise, check if it's a swipe from the edge
        if (e.center.x < window.innerWidth * 0.2) { // 20% from left edge
            if (currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/')) {
                // On home page, open burger menu
                toggleMenu();
            } else {
                // On other pages, go back
                window.history.back();
            }
        }
    });
    
    // Handle edge swipe for menu
    hammer.on('swiperight', function(e) {
        // If swipe starts near the left edge (first 20% of screen width)
        if (e.center.x < window.innerWidth * 0.2) {
            toggleMenu();
        }
    });
});

// Function to toggle the burger menu
function toggleMenu() {
    // Get your menu element
    const menu = document.querySelector('.sidebar') || document.querySelector('.burger-menu-content');
    
    // Check if the menu exists and toggle it
    if (menu) {
        menu.classList.toggle('active');
        
        // If you have an overlay
        const overlay = document.querySelector('.overlay');
        if (overlay) {
            overlay.classList.toggle('active');
        }
    }
}
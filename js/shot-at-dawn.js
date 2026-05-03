// Shot at Dawn Memorial - Interactive Visualization
// 309 memorial posts arranged in 10 curved rows (amphitheatre style)

class ShotAtDawnMemorial {
    constructor() {
        this.svg = document.getElementById('memorial');
        this.tooltip = document.getElementById('tooltip');
        this.selectedInfo = document.getElementById('selectedInfo');
        this.selectedText = document.getElementById('selectedText');
        this.nameSearchInput = document.getElementById('nameSearch');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        
        // Memorial data from CSV
        this.memorialData = {};
        
        // Row configuration (outer to inner)
        this.rows = [
            { count: 48, radius: 380 },
            { count: 45, radius: 345 },
            { count: 41, radius: 310 },
            { count: 37, radius: 275 },
            { count: 33, radius: 240 },
            { count: 29, radius: 205 },
            { count: 25, radius: 170 },
            { count: 21, radius: 135 },
            { count: 17, radius: 100 },
            { count: 13, radius: 65 }
        ];
        
        this.posts = [];
        this.selectedPost = null;
        
        this.init();
    }
    
    async init() {
        await this.loadCSVData();
        this.createPosts();
        this.populateNamesList();
        this.attachEventListeners();
    }
    
    async loadCSVData() {
        try {
            const response = await fetch('../data/SaD.csv');
            const csvText = await response.text();
            this.parseCSV(csvText);
        } catch (error) {
            console.error('Error loading CSV:', error);
        }
    }
    
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').slice(1); // Skip first column, get post numbers
        
        const rankRow = lines[1].split(',').slice(1);
        const surnameRow = lines[2].split(',').slice(1);
        const firstNameRow = lines[3].split(',').slice(1);
        const unitRow = lines[4].split(',').slice(1);
        const dateRow = lines[5].split(',').slice(1);
        const ageRow = lines[6].split(',').slice(1);
        const notesRow = lines[7].split(',').slice(1);
        
        for (let i = 0; i < headers.length; i++) {
            const postNumber = parseInt(headers[i]);
            this.memorialData[postNumber] = {
                rank: rankRow[i] || '',
                surname: surnameRow[i] || '',
                firstName: firstNameRow[i] || '',
                unit: unitRow[i] || '',
                dateOfExecution: dateRow[i] || '',
                age: ageRow[i] || '',
                notes: notesRow[i] || ''
            };
        }
    }
    
    createPosts() {
        const centerX = 600;
        const centerY = 550; // Center at bottom so arc curves upward
        const arcAngle = 180; // Full 180-degree semicircle
        let postNumber = 1;
        
        this.rows.forEach((row, rowIndex) => {
            const { count, radius } = row;
            const startAngle = 180; // Start at far left (180 degrees)
            const angleStep = arcAngle / (count - 1);
            
            // Go from left (180°) to right (0°)
            for (let i = 0; i < count; i++) {
                const angle = startAngle - (i * angleStep);
                const radian = (angle * Math.PI) / 180;
                
                const x = centerX + radius * Math.cos(radian);
                const y = centerY - radius * Math.sin(radian); // Subtract to make arc open upward
                
                // Calculate row number (innermost = 1, outermost = 10)
                const rowNumber = 10 - rowIndex;
                const positionInRow = i + 1;
                
                this.createPost(x, y, postNumber, rowNumber, positionInRow);
                postNumber++;
            }
        });
    }
    
    createPost(x, y, number, rowNumber, positionInRow) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('post');
        group.setAttribute('data-number', number);
        group.setAttribute('data-row', rowNumber);
        group.setAttribute('data-position', positionInRow);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', this.getPostRadius(number));
        
        group.appendChild(circle);
        this.svg.appendChild(group);
        
        this.posts.push({ element: group, number, x, y, rowNumber, positionInRow });
        
        // Event listeners for hover and click
        group.addEventListener('mouseenter', (e) => this.showTooltip(e, number, rowNumber, positionInRow));
        group.addEventListener('mousemove', (e) => this.updateTooltipPosition(e));
        group.addEventListener('mouseleave', () => this.hideTooltip());
        group.addEventListener('click', () => this.selectPost(number));
    }
    
    getPostRadius(number) {
        // Uniform size for all posts
        return 7;
    }
    
    showTooltip(event, number, rowNumber, positionInRow) {
        const data = this.memorialData[number];
        if (data) {
            const name = `${data.rank} ${data.firstName} ${data.surname}`.trim();
            this.tooltip.innerHTML = `<strong>Post ${number}</strong><br>${name}<br><small>Row ${rowNumber}, Position ${positionInRow}</small>`;
        } else {
            this.tooltip.innerHTML = `Post ${number}<br><small>Row ${rowNumber}, Position ${positionInRow}</small>`;
        }
        this.tooltip.classList.add('show');
        this.updateTooltipPosition(event);
    }
    
    updateTooltipPosition(event) {
        const offset = 15;
        this.tooltip.style.left = `${event.clientX + offset}px`;
        this.tooltip.style.top = `${event.clientY + offset}px`;
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('show');
    }
    
    selectPost(number) {
        // Remove previous selection
        if (this.selectedPost) {
            this.selectedPost.element.classList.remove('selected');
        }
        
        // Find and select new post
        const post = this.posts.find(p => p.number === number);
        if (post) {
            post.element.classList.add('selected');
            this.selectedPost = post;
            
            // Display selected post information
            const data = this.memorialData[number];
            if (data) {
                const name = `${data.rank} ${data.firstName} ${data.surname}`.trim();
                let html = `<div class="post-detail">`;
                html += `<h3>Post ${number}</h3>`;
                html += `<p><strong>Name:</strong> ${name}</p>`;
                html += `<p><strong>Unit:</strong> ${data.unit}</p>`;
                html += `<p><strong>Date of Execution:</strong> ${data.dateOfExecution}</p>`;
                html += `<p><strong>Age:</strong> ${data.age}</p>`;
                html += `<p><strong>Location:</strong> Row ${post.rowNumber}, Position ${post.positionInRow}</p>`;
                if (data.notes) {
                    html += `<p><strong>Notes:</strong> ${data.notes}</p>`;
                }
                html += `</div>`;
                this.selectedText.innerHTML = html;
            } else {
                this.selectedText.textContent = `Post ${number} - Row ${post.rowNumber}, Position ${post.positionInRow}`;
            }
            this.selectedInfo.style.display = 'block';
            
            // Highlight in names list
            document.querySelectorAll('.name-item').forEach(item => item.classList.remove('active'));
            const listItem = document.querySelector(`.name-item[data-post="${number}"]`);
            if (listItem) {
                listItem.classList.add('active');
                // Scroll the list item into view
                listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            // Scroll post into view (center it)
            this.scrollToPost(post);
        }
    }
    
    scrollToPost(post) {
        const svg = this.svg;
        const container = svg.parentElement;
        
        // For better UX, we could implement smooth SVG pan/zoom here
        // For now, the post will be visually highlighted
    }
    
    navigatePrevious() {
        if (this.selectedPost && this.selectedPost.number > 1) {
            this.selectPost(this.selectedPost.number - 1);
        } else {
            this.selectPost(309); // Wrap to last
        }
    }
    
    navigateNext() {
        if (this.selectedPost && this.selectedPost.number < 309) {
            this.selectPost(this.selectedPost.number + 1);
        } else {
            this.selectPost(1); // Wrap to first
        }
    }
    
    populateNamesList() {
        const namesList = document.getElementById('namesList');
        if (!namesList) return;
        
        namesList.innerHTML = '';
        
        const searchTerm = this.nameSearchInput.value.toLowerCase();
        
        // Create list items for each post in numerical order
        for (let i = 1; i <= 309; i++) {
            const data = this.memorialData[i];
            if (data) {
                const name = `${data.rank} ${data.firstName} ${data.surname}`.trim();
                
                // Filter by search term
                if (searchTerm && !name.toLowerCase().includes(searchTerm)) {
                    continue;
                }
                
                const listItem = document.createElement('div');
                listItem.className = 'name-item';
                listItem.setAttribute('data-post', i);
                
                listItem.innerHTML = `
                    <span class="post-num">${i}</span>
                    <span class="name-text">${name}</span>
                `;
                
                listItem.addEventListener('click', () => {
                    this.selectPost(i);
                    // Highlight the selected item in the list
                    document.querySelectorAll('.name-item').forEach(item => item.classList.remove('active'));
                    listItem.classList.add('active');
                });
                
                namesList.appendChild(listItem);
            }
        }
    }
    
    attachEventListeners() {
        // Real-time name filtering
        this.nameSearchInput.addEventListener('input', () => {
            this.populateNamesList();
        });
        
        this.prevBtn.addEventListener('click', () => this.navigatePrevious());
        this.nextBtn.addEventListener('click', () => this.navigateNext());
        
        // Prevent tooltip from staying visible on touch devices
        document.addEventListener('touchstart', () => this.hideTooltip());
    }
}

// Initialize memorial when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ShotAtDawnMemorial();
});

const fs = require('fs');
const path = require('path');

// Function to scan for projects (copy from server.js)
function scanProjects() {
    const projectsDir = path.join(__dirname, 'projects');
    let projects = [];
    
    console.log('Scanning directory:', projectsDir);
    
    try {
        // Check if projects directory exists
        if (!fs.existsSync(projectsDir)) {
            console.error('Projects directory does not exist!');
            return projects;
        }
        
        // Read the projects directory
        const items = fs.readdirSync(projectsDir);
        console.log('Found items in directory:', items);
        
        // Filter for directories only
        for (const item of items) {
            const itemPath = path.join(projectsDir, item);
            console.log('Checking item:', item, 'at path:', itemPath);
            
            try {
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    // Check if the directory has an index.html file
                    const indexPath = path.join(itemPath, 'index.html');
                    console.log('Looking for index.html at:', indexPath);
                    
                    if (fs.existsSync(indexPath)) {
                        console.log('Found index.html for project:', item);
                        
                        try {
                            // Get project title from the HTML file
                            const content = fs.readFileSync(indexPath, 'utf8');
                            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
                            const title = titleMatch ? titleMatch[1] : item;
                            
                            const project = {
                                id: item.replace(/\s+/g, '-').toLowerCase(),
                                name: item,
                                title: title,
                                path: `/projects/${item}/index.html`
                            };
                            
                            console.log('Adding project:', project);
                            projects.push(project);
                        } catch (readError) {
                            console.error('Error reading index.html for project:', item, readError);
                        }
                    } else {
                        console.log('No index.html found for:', item);
                    }
                } else {
                    console.log('Not a directory:', item);
                }
            } catch (statError) {
                console.error('Error checking item:', item, statError);
            }
        }
    } catch (error) {
        console.error('Error scanning projects:', error);
    }
    
    console.log('Total projects found:', projects.length);
    return projects;
}

// Run the test
const projects = scanProjects();
console.log('\nFinal projects list:');
console.log(JSON.stringify(projects, null, 2)); 
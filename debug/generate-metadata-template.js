/**
 * Metadata Template Generator
 * 
 * This script checks for projects without metadata.json files and creates templates for them.
 * Run this script after adding new projects to generate metadata templates automatically.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const projectsDir = path.join(__dirname, '..', 'projects');
const metadataTemplate = {
    "description": "Describe your AR project here. What does it demonstrate? What makes it unique?",
    "author": "Your Name or Team",
    "technologies": ["A-Frame", "AR.js", "WebXR"],
    "instructions": "Provide instructions on how to use this AR experience. What should users do with the marker? What will they see?"
};

// Function to check and create metadata templates
function generateMetadataTemplates() {
    console.log('Checking for projects without metadata.json files...');
    
    try {
        // Check if projects directory exists
        if (!fs.existsSync(projectsDir)) {
            console.error('Projects directory does not exist!');
            return;
        }
        
        // Read the projects directory
        const items = fs.readdirSync(projectsDir);
        console.log(`Found ${items.length} items in projects directory`);
        
        let templatesCreated = 0;
        
        // Check each project folder
        for (const item of items) {
            const itemPath = path.join(projectsDir, item);
            
            try {
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    // Check if the directory has an index.html file (confirming it's a project)
                    const indexPath = path.join(itemPath, 'index.html');
                    
                    if (fs.existsSync(indexPath)) {
                        // Check if metadata.json already exists
                        const metadataPath = path.join(itemPath, 'metadata.json');
                        
                        if (!fs.existsSync(metadataPath)) {
                            console.log(`Creating metadata template for project: ${item}`);
                            
                            // Get project title from the HTML file to customize template
                            const content = fs.readFileSync(indexPath, 'utf8');
                            const titleMatch = content.match(/<title>(.*?)<\/title>/i);
                            const title = titleMatch ? titleMatch[1] : item;
                            
                            // Customize template with project title
                            const customTemplate = { ...metadataTemplate };
                            customTemplate.description = `The ${title} project demonstrates augmented reality capabilities using web technologies.`;
                            
                            // Write the template file
                            fs.writeFileSync(
                                metadataPath, 
                                JSON.stringify(customTemplate, null, 4),
                                'utf8'
                            );
                            
                            templatesCreated++;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing item ${item}:`, error);
            }
        }
        
        if (templatesCreated > 0) {
            console.log(`✅ Created ${templatesCreated} metadata template(s)`);
        } else {
            console.log('✅ All projects already have metadata.json files');
        }
        
    } catch (error) {
        console.error('Error scanning projects:', error);
    }
}

// Run the function
generateMetadataTemplates();

console.log('\nTo use this template:');
console.log('1. Open the metadata.json file in each project folder');
console.log('2. Replace the placeholder text with actual project information');
console.log('3. The information will appear in the project info panel'); 
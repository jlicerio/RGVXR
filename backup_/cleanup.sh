#!/bin/bash

# Create backup directory
mkdir -p backup_$(date +%Y%m%d)

# Move old files to backup
mv old/* backup_$(date +%Y%m%d)/

# Clean up empty old directory
rmdir old

# Move carousel-enhancements.js to backup since it's not being used
mv carousel-enhancements.js backup_$(date +%Y%m%d)/

# Clean up any temporary files
find . -name "*.tmp" -type f -delete
find . -name "*.log" -type f -delete

# Optional: Clean up any empty directories
find . -type d -empty -delete

echo "Cleanup completed. Backup created in backup_$(date +%Y%m%d)/" 
#!/bin/bash

# Configuration
DB_PATH="dev.db"
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Creating backup of $DB_PATH to $BACKUP_FILE..."

if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "$BACKUP_FILE"
    if [ $? -eq 0 ]; then
        echo "✅ Backup successful: $BACKUP_FILE"
    else
        echo "❌ Backup failed!"
        exit 1
    fi
else
    echo "❌ Database file $DB_PATH not found!"
    exit 1
fi

# Amana Kuku Feeds Desktop Inventory (2 Users)

This project now supports a true Windows desktop app and server-ready sync flow.

## Current Functionalities
- Two user roles: owner and employee
- Login authentication
- Inventory create, update, reorder alerts
- Owner-only delete permission
- Brand and feed type validation rules
- Date displayed as `DD/MM/YYYY`
- Auto refresh every 5 seconds for near-real-time updates

## Default Login
- `owner` / `Owner@123`
- `employee` / `Employee@123`

## Run During Development
1. Install dependencies:
   - `npm install`
2. Start server only:
   - `npm start`
3. Start desktop app with bundled local server:
   - `npm run desktop`

## Build Installable Desktop App (.exe)
1. Install dependencies:
   - `npm install`
2. Build installer:
   - `npm run dist`
3. Installer output:
   - `dist\Amana Kuku Feeds Inventory Setup *.exe`

Use this installer on each desktop (owner and employee machines).

## Before Buying Small Server
- Both desktops can run the app independently with full functionality.
- Each desktop has its own local data file for now.

## After Buying Small Server (Real-Time Shared Data)
- Run backend on the server:
  - `npm start`
- Point desktop clients to server URL by launching with:
  - PowerShell: `$env:AMANA_SERVER_URL="http://SERVER_IP:3000"; npm run desktop`
  - Command Prompt: `set AMANA_SERVER_URL=http://SERVER_IP:3000 && npm run desktop`
- Both desktops then read/write the same shared data.

## Data Storage
- SQLite database file: `data/inventory.db`

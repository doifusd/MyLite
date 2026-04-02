# Testing Guide: Table Structure & CREATE Template Features

## Prerequisites
- Development server running (`npm run tauri:dev`)
- MySQL database connected with at least one table selected in Schema Browser
- Application compiled without errors

## Feature 1: Show Structure as JSON

### Test Steps
1. **Open application** and connect to a database
2. **Navigate to Schema Browser** (left panel)
3. **Right-click any table** in the schema tree
4. **Verify context menu** includes new option **"Show Structure as JSON"**
5. **Click "Show Structure as JSON"** button
6. **Verify modal opens** with:
   - ✓ Table title at top (e.g., "users - Structure")
   - ✓ Loading spinner briefly appears (if table is large)
   - ✓ JSON structure displays in code block
   - ✓ Structure includes: columns[], indexes[], engine, collation, comment
7. **Click "Copy JSON"** button
   - ✓ Button changes to "Copied!" with check icon for 2 seconds
   - ✓ Toast notification shows "Table structure copied to clipboard"
   - ✓ JSON actually copied to clipboard (paste anywhere to verify)
8. **Press Escape key** to close modal
   - ✓ Modal closes without error
9. **Click "Close" button** to close modal
   - ✓ Modal closes smoothly

### Expected JSON Structure
```json
{
  "name": "table_name",
  "schema": "database_name",
  "engine": "InnoDB",
  "collation": "utf8mb4_general_ci",
  "comment": "Table comment or null",
  "row_count": 1000,
  "columns": [
    {
      "name": "id",
      "type": "int",
      "nullable": false,
      "default": null,
      "primary_key": true,
      "auto_increment": true,
      "comment": "Primary key",
      "max_length": null,
      "numeric_precision": 10,
      "numeric_scale": 0
    }
  ],
  "indexes": [
    {
      "name": "PRIMARY",
      "unique": true,
      "primary": true,
      "columns": ["id"]
    }
  ]
}
```

### Error Handling Tests
- **Disconnect database** during JSON fetch
  - ✓ Toast shows "Failed to load table structure: [error message]"
  - ✓ Modal does not open
- **Load structure for multiple tables**
  - ✓ Each shows correct structure (no cross-table contamination)
  - ✓ Can open and close multiple times without memory leaks

---

## Feature 2: CREATE TABLE Template Generation

### Test Steps - Template from Existing Table
1. **In Schema Browser**, right-click any table
2. **Click "Create New Table"**
   - ✓ Modal does NOT open (different from database right-click)
   - ✓ Query tab automatically switches to active
   - ✓ SQL template auto-populates in SQL editor
3. **Verify template SQL** contains:
   - ✓ Database name in backticks: `CREATE TABLE \`dbname\`.\`tablename\``
   - ✓ Standard fields: id, name, status, created_at, updated_at
   - ✓ Proper MySQL syntax: backticks, data types, comments
   - ✓ Example:
     ```sql
     CREATE TABLE `database`.`new_table` (
       `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
       `name` varchar(255) NOT NULL DEFAULT '' COMMENT '名称',
       `status` tinyint(1) DEFAULT '1' COMMENT '状态',
       `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
       `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
       PRIMARY KEY (`id`)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='new_table表';
     ```
4. **Edit template** as needed (change column names, types, etc.)
5. **Execute query** using Ctrl+Enter or execute button
   - ✓ Table creates successfully
   - ✓ Schema Browser refreshes to show new table

### Test Steps - Create New Table Dialog (Database Right-Click)
1. **Right-click a DATABASE** in Schema Browser
2. **Click "Create New Table"**
   - ✓ Modal DOES open (original CreateTableDialog)
   - ✓ You can add custom columns through UI
   - ✓ Different UX from table template generation

### Behavior Verification
- **Context menu appears** when right-clicking:
  - ✓ Table: Shows "Create New Table" (generates template)
  - ✓ Database: Shows "Create New Table" (opens dialog)
- **Multiple templates** can be generated
  - ✓ Each one has correct database/table name
  - ✓ Can switch between templates by clicking different tables
- **SQL persists** after tab switches
  - ✓ Generate template → Go to Data tab → Return to Query tab
  - ✓ Template SQL still there

### Error Handling Tests
- **Generate template for different databases**
  - ✓ Database name updates correctly
- **Escape special characters** in table names
  - ✓ Backticks properly applied
- **Generate multiple templates** in quick succession
  - ✓ No race conditions or overlapping code

---

## Toast Notification Tests

### Copy Success Toast
- Text: "Table structure copied to clipboard" (Success variant)
- ✓ Appears and disappears automatically
- ✓ Non-blocking (doesn't prevent interaction)

### Error Toasts
Test these error scenarios:
- **Network error loading structure**
  - ✓ Toast shows: "Failed to load table structure: [error message]"
- **Drop table success**
  - ✓ Toast shows: "Table '[tablename]' dropped successfully"
- **Drop table failure**
  - ✓ Toast shows: "Failed to drop table: [error message]"
- **Create table success**
  - ✓ Toast shows: "Table created successfully"
- **Create table failure**
  - ✓ Toast shows: "Failed to create table: [error message]"

---

## UI/UX Tests

### Responsive Behavior
1. **Large table structures** (50+ columns)
   - ✓ Modal scrolls properly
   - ✓ JSON readable in code block
   - ✓ Copy still works

2. **Various screen sizes**
   - ✓ Modal appears centered
   - ✓ Buttons visible and clickable
   - ✓ No layout breaking

### Accessibility
1. **Keyboard navigation**
   - ✓ Tab through buttons works
   - ✓ Enter activates buttons
   - ✓ Escape closes modal

2. **Visual consistency**
   - ✓ Styling matches app theme (light/dark mode)
   - ✓ Buttons match app button style
   - ✓ Modal uses Dialog component

---

## Integration Tests

### Data Flow
1. Generate template → See in Query tab → Modify → Execute → Refresh Schema Browser
   - ✓ New table appears in tree
   - ✓ Can right-click new table → Show Structure as JSON
   - ✓ Shows correct structure

2. Show Structure → Copy JSON → Use in external tool
   - ✓ JSON is valid and properly formatted
   - ✓ Can paste into JSON validator without errors

### State Consistency
- Switch between databases/tables showing structure
  - ✓ Each shows correct data
  - ✓ No data bleeding between tables
- Generate multiple templates
  - ✓ Each replaces previous (correct behavior)
  - ✓ No accumulation of code

---

## Success Criteria ✅

**All of the following must pass:**
- [ ] Show Structure as JSON modal appears and displays JSON
- [ ] Copy JSON button copies to clipboard
- [ ] Toast notifications appear for all operations
- [ ] Template generation populates Query editor
- [ ] Context menu behaves differently for table vs database
- [ ] Keyboard shortcuts work (Escape to close, Ctrl+Enter to execute)
- [ ] No console errors or warnings
- [ ] No memory leaks (opening/closing repeatedly)
- [ ] Responsive on different screen sizes
- [ ] Works in both light and dark modes

---

## Known Limitations / Notes

1. CREATE TABLE template is a basic skeleton
   - Users should customize based on their needs
   - Includes common fields (id, name, status, timestamps)

2. "Create New Table" context menu item has dual behavior
   - Right-click table → Template generation
   - Right-click database → Dialog for custom creation
   - This is by design for power user efficiency

3. JSON structure export
   - For reference only, not guaranteed for re-import
   - Use "Show DDL" if you need CREATE TABLE statement from existing table

---

## Troubleshooting

### "Show Structure as JSON" button doesn't appear
- ✓ Verify you're right-clicking a table (not database)
- ✓ Restart dev server

### Template SQL doesn't populate
- ✓ Check that event is being fired (check browser console)
- ✓ Verify `onCreateTableSQL` callback is wired up correctly

### Toast notifications don't appear
- ✓ Verify Toast component is rendered in App.tsx
- ✓ Check that `@/hooks/use-toast` imports work

### Modal styling looks broken
- ✓ Verify Dialog component is installed from shadcn/ui
- ✓ Check Tailwind CSS is properly configured
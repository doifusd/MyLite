# Go Struct Generation Update

## Changes Made

### 1. Menu Label Update
- **Before:** "Show Structure as JSON"
- **After:** "Show Structure"

### 2. Display Format Update
- **Before:** JSON format (key-value pairs)
- **After:** Go struct format with proper tags

### 3. Go Type Conversion
The implementation now converts MySQL types to Go types:

| MySQL Type | Go Type |
|-----------|---------|
| tinyint | int8 |
| smallint | int16 |
| mediumint | int32 |
| int, integer | int32 |
| bigint | int64 |
| float | float32 |
| double, decimal | float64 |
| varchar, char, text | string |
| date, datetime, timestamp | string |
| boolean, bool | bool |
| json | string |
| blob, longblob | []byte |

### 4. Naming Convention
- **Table names:** Converted to PascalCase
  - `user_account` → `UserAccount`
  - `product_list` → `ProductList`
- **Column names:** Converted to PascalCase for struct fields
  - `product_name` → `ProductName`
  - `user_id` → `UserId`

### 5. Struct Tags
All fields include both JSON and database tags:
```go
FieldName Type `json:"field_name" db:"field_name"`
```

## Example Output

For a MySQL table:
```sql
CREATE TABLE ai_charge_points (
  id bigint,
  product_name varchar(255),
  price float,
  points int,
  status tinyint
)
```

Generated Go struct:
```go
type AiChargePoints struct {
	Id int64 `json:"id" db:"id"`
	ProductName string `json:"product_name" db:"product_name"`
	Price float64 `json:"price" db:"price"`
	Points int32 `json:"points" db:"points"`
	Status int8 `json:"status" db:"status"`
}
```

## Implementation Details

### SchemaBrowser.tsx Functions

1. **convertToGoType(mysqlType, isNullable)**
   - Maps MySQL types to Go types
   - Handles nullable fields with `*` prefix (optional)
   - Returns appropriate Go type string

2. **toPascalCase(str)**
   - Converts snake_case to PascalCase
   - Used for table and field names
   - Splits by `_` and capitalizes each word

3. **generateGoStruct(tableName, columns)**
   - Takes table name and column list
   - Generates complete Go struct code
   - Includes proper formatting and indentation
   - Returns formatted struct string

### StructureDialog.tsx Updates

- Dialog title: "{table} - Go Struct"
- Copy button: "Copy Struct" (instead of "Copy JSON")
- Display: Pre-formatted code block with monospace font
- Format: `font-mono whitespace-pre-wrap break-words`

## Usage

1. **Right-click any table** in Schema Browser
2. **Select "Show Structure"** from context menu
3. **Modal appears** with generated Go struct code
4. **Click "Copy Struct"** to copy code to clipboard
5. **Paste** in your Go files as needed

## Type Mapping Notes

- **Nullable fields**: Currently displayed without `*` prefix (can be enabled by checking `is_nullable` flag)
- **Precision types**: Decimal/numeric types map to float64
- **Temporal types**: Date/datetime/timestamp map to string (consider time.Time if preferred)
- **Boolean**: Stored as tinyint(1) in MySQL, maps to bool in Go

## Future Enhancements

- [ ] Option to use `time.Time` for date/datetime fields
- [ ] Option to include `*` for nullable fields
- [ ] Support for custom type mapping configuration
- [ ] Export multiple tables at once
- [ ] Template variables in code generation
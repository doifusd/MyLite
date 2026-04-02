# Go Struct Structure - Quick Test Guide

## Feature: Show Structure (Go Struct Format)

### How to Use

1. **Connect to Database** in the application
2. **Select a table** in the Schema Browser (left panel)
3. **Right-click the table** to open context menu
4. **Click "Show Structure"** (previously "Show Structure as JSON")
5. **Modal appears** showing the Go struct code
6. **Click "Copy Struct"** to copy code to clipboard
7. **Paste in your Go project** as needed

### Example Workflow

#### Input: MySQL Table
```sql
CREATE TABLE ai_charge_points (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  product_name varchar(255) NOT NULL,
  price float NOT NULL,
  points int NOT NULL,
  status tinyint DEFAULT 1
);
```

#### Output: Go Struct
```go
type AiChargePoints struct {
	Id int64 `json:"id" db:"id"`
	ProductName string `json:"product_name" db:"product_name"`
	Price float32 `json:"price" db:"price"`
	Points int32 `json:"points" db:"points"`
	Status int8 `json:"status" db:"status"`
}
```

#### Usage in Go Code
```go
// Ready to use in your models
type Repository interface {
	SaveChargePoint(ctx context.Context, point *AiChargePoints) error
}

// Works with popular Go SQL libraries
// - database/sql with GORM
// - database/sql with sqlc
// - EntGo
// - etc.
```

## Type Mapping Reference

### Basic Types
| MySQL | Go | Example |
|-------|----|---------| 
| int, integer | int32 | PostId int32 |
| bigint | int64 | UserId int64 |
| tinyint | int8 | Status int8 |
| smallint | int16 | Priority int16 |

### Decimal Types
| MySQL | Go | Example |
|-------|----|---------| 
| float | float32 | Price float32 |
| double, decimal | float64 | Amount float64 |

### String Types
| MySQL | Go | Example |
|-------|----|---------| 
| varchar, char | string | Name string |
| text, longtext | string | Description string |
| json | string | MetaData string |

### Special Types
| MySQL | Go | Example |
|-------|----|---------| 
| date, datetime, timestamp | string | CreatedAt string |
| bool, boolean | bool | IsActive bool |
| blob, longblob | []byte | Data []byte |

## Field Naming Convention

Column names are automatically converted to Go naming convention (PascalCase):

| MySQL Column | Go Field |
|--------------|----------|
| id | Id |
| user_id | UserId |
| product_name | ProductName |
| created_at | CreatedAt |
| is_active | IsActive |
| first_name | FirstName |

## Tags Included

Each field automatically includes both JSON and database tags:

```go
FieldName Type `json:"column_name" db:"column_name"`
```

### Examples
```go
UserId int64 `json:"user_id" db:"user_id"`
CreatedAt string `json:"created_at" db:"created_at"`
IsActive bool `json:"is_active" db:"is_active"`
```

These tags work with:
- Standard `json` package for marshaling/unmarshaling
- Most Go database libraries (GORM, sqlc, database/sql, etc.)
- REST API frameworks

## Testing Steps

### Step 1: Verify Menu Item
- [ ] Right-click a table in Schema Browser
- [ ] Context menu appears
- [ ] "Show Structure" option is visible (not "Show Structure as JSON")

### Step 2: Verify Modal Opens
- [ ] Click "Show Structure"
- [ ] Modal dialog appears
- [ ] Title shows: "[TableName] - Go Struct"
- [ ] Code block displays Go struct syntax

### Step 3: Verify Code Generation
- [ ] Struct name is in PascalCase
- [ ] All columns are included
- [ ] Field names are in PascalCase
- [ ] Types are appropriate Go types
- [ ] JSON and db tags are included

### Step 4: Verify Copy Functionality
- [ ] Click "Copy Struct" button
- [ ] Button changes to "Copied!" with check mark
- [ ] Toast notification shows success message
- [ ] Paste code somewhere (text editor, etc.)
- [ ] Verify code is correct Go syntax

### Step 5: Verify Different Tables
- [ ] Close modal
- [ ] Right-click a different table
- [ ] Click "Show Structure"
- [ ] Verify the new table's struct is displayed
- [ ] Verify struct name matches the table

## Common Use Cases

### 1. ORM Model Definition
Use the generated struct as a base for GORM models:
```go
type UserProfile struct {
	UserId int64 `json:"user_id" db:"user_id" gorm:"primaryKey"`
	Name string `json:"name" db:"name"`
	Email string `json:"email" db:"email" gorm:"uniqueIndex"`
}
```

### 2. API Request/Response
Use for API DTOs:
```go
type ChargePointResponse struct {
	Id int64 `json:"id"`
	ProductName string `json:"product_name"`
	Price float32 `json:"price"`
	Points int32 `json:"points"`
	Status int8 `json:"status"`
}
```

### 3. Database Query Results
Use with sqlc or similar tools:
```go
// Generated code interfaces with database
var point AiChargePoints
err := db.QueryRow("SELECT * FROM ai_charge_points WHERE id = ?", id).Scan(
	&point.Id,
	&point.ProductName,
	&point.Price,
	&point.Points,
	&point.Status,
)
```

## Troubleshooting

### Issue: Button says "Copy JSON" instead of "Copy Struct"
- **Cause:** Outdated code
- **Fix:** Restart dev server or clear browser cache

### Issue: Struct code looks malformed
- **Cause:** Unusual table/column names
- **Fix:** Contact support with table structure details

### Issue: Wrong type mapping
- **Cause:** Unsupported MySQL type variant
- **Fix:** Check GO_STRUCT_GENERATION.md for type mapping, manually adjust

## Next Steps

1. **Test with your databases**
2. **Copy generated structs** into your Go projects
3. **Adjust as needed** (add tags, change types, etc.)
4. **Provide feedback** on improvements
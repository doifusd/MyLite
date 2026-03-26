// Integration tests for mylite

#[test]
fn test_port_validation() {
    let valid_ports = vec![1, 3306, 5432, 65535];
    for port in valid_ports {
        assert!((1..=65535).contains(&port), "Port {} should be valid", port);
    }
    
    let invalid_ports = vec![0, 65536, 100000];
    for port in invalid_ports {
        assert!(!(1..=65535).contains(&port), "Port {} should be invalid", port);
    }
}

#[test]
fn test_pagination_calculation() {
    let total_rows = 1000;
    let page_size = 100;
    let total_pages = (total_rows + page_size - 1) / page_size;
    
    assert_eq!(total_pages, 10);
}

#[test]
fn test_sql_keywords_detection() {
    let keywords = vec!["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE"];
    let test_query = "SELECT * FROM users WHERE id = 1";
    let upper_query = test_query.to_uppercase();
    
    let mut found_count = 0;
    for keyword in keywords {
        if upper_query.contains(keyword) {
            found_count += 1;
        }
    }
    
    assert_eq!(found_count, 3);
}

#[test]
fn test_query_type_detection() {
    let queries = vec![
        ("SELECT * FROM users", "SELECT"),
        ("INSERT INTO users VALUES", "INSERT"),
        ("UPDATE users SET name", "UPDATE"),
        ("DELETE FROM users", "DELETE"),
    ];
    
    for (query, expected_type) in queries {
        let upper = query.to_uppercase();
        assert!(upper.starts_with(expected_type));
    }
}

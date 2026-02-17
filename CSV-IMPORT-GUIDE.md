# CSV Import Guide

This guide explains how to prepare a CSV file for importing WordPress users into the system.

## Example File

See `example-user-import.csv` for a working template with one sample user.

## Supported Headers

The import system recognizes multiple variations of header names. You only need to include ONE variation of each field in your CSV.

### Required Fields

| Field Type | Accepted Header Names |
|-----------|----------------------|
| **Email** (REQUIRED) | `email`, `user_email`, `User Email` |

### Optional Fields

| Field Type | Accepted Header Names |
|-----------|----------------------|
| **Username** | `Username`, `username`, `user_login`, `user_nicename`, `display_name`, `Display Name` |
| **First Name** | `First Name`, `first_name` |
| **Last Name** | `Last Name`, `last_name` |
| **Display Name** | `Display Name`, `display_name` |
| **Phone** | `phone`, `Phone` |
| **Registration Date** | `User Registered`, `User Registered(date)`, `user_registered` |
| **Nicename** | `User Nicename`, `user_nicename` |

## Field Behavior

- **Email**: Must be present in every row. Rows without email will be skipped.
- **Username**: If not provided, the system will use the part before @ in the email address.
- **Registration Date**: Accepts formats like `2024-01-15` or `2024-01-15 10:30:00`. If not provided or invalid, uses current date.
- **Display Name**: Can be auto-generated from First Name + Last Name if not provided.

## Delimiters

The system auto-detects delimiters:
- Comma (`,`) - default
- Semicolon (`;`) - automatically detected if more common than commas

## Import Process

When you import users:
1. Each user is created with a secure random password
2. A password reset token is generated for each user
3. The system provides reset URLs that can be emailed to users
4. Users can set their own password using the reset link

## Tips

- Use the `example-user-import.csv` as your starting template
- Keep header names exactly as shown (case-sensitive)
- Make sure email addresses are valid
- Date format should be YYYY-MM-DD or ISO format
- Remove any empty rows at the end of your CSV

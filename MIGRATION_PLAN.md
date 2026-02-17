
# WordPress User Migration Plan

## Overview
This document outlines the complete process for migrating WordPress users to the new HAYC system. The migration includes user account creation, password reset token generation, and optional Stripe subscription matching.

## Prerequisites

### System Requirements
- Admin access to the HAYC platform
- WordPress user export in CSV format
- SMTP email configuration for password reset emails
- Database backup before migration (recommended)

### CSV Format Requirements
The CSV export should contain the following columns (order doesn't matter):
- `Username` - WordPress username
- `User Email` - User's email address (required)
- `First Name` - User's first name
- `Last Name` - User's last name
- `User Registered(date)` - Registration date (optional, format: YYYY-MM-DD or ISO date)

**Supported CSV separators:** Both comma (`,`) and semicolon (`;`) separators are automatically detected.

## Phase 1: Testing & Validation

### Step 1: Prepare Test Data
1. Export a small subset of WordPress users (5-10 users) for testing
2. Ensure the CSV includes various edge cases:
   - Users with different date formats
   - Users with special characters in names
   - Users with missing optional fields

### Step 2: Upload and Test CSV
1. Login to HAYC admin panel (`/admin`)
2. Navigate to the "User Migration" section
3. Upload the test CSV file using the file upload option
4. Click "Test CSV Parse" to validate the format

**Expected Results:**
- System should detect the correct delimiter (comma or semicolon)
- Display "Users Found: X" where X matches your test user count
- Show preview of first 5 users with their email addresses
- Registration dates should appear if available in CSV

### Step 3: Test Import Process
1. After successful CSV parsing, click "Import WordPress Users"
2. Monitor the import results:
   - Check "Imported" count matches expected
   - Verify "Skipped" count (should be 0 for new users)
   - Review any errors in the error section

### Step 4: Verify User Creation
1. Check that test users appear in the user list
2. Verify user details are correctly mapped:
   - Email addresses are correct
   - Usernames are properly set
   - Registration dates are preserved (if provided)
3. Confirm password reset tokens are generated

### Step 5: Test Password Reset Process
1. Download the password reset tokens CSV
2. Manually test 1-2 reset links:
   - Click the reset URL from the CSV
   - Verify the reset page loads correctly
   - Test setting a new password
   - Confirm login works with the new password

### Step 6: Test Email Sending (Optional)
1. Use the "Send Password Reset Emails" section
2. Send test emails to 1-2 imported users
3. Verify emails are delivered and formatted correctly
4. Test the reset process via email

## Phase 2: Production Migration

### Step 1: Database Backup
```bash
# Create a backup before starting migration
# This should be done by your database administrator
```

### Step 2: Export WordPress Users
1. Export all WordPress users from your WordPress admin
2. Ensure the CSV contains all required columns
3. Verify the file size and user count are as expected

### Step 3: Pre-Migration Checklist
- [ ] Database backup completed
- [ ] CSV file validated and tested
- [ ] SMTP settings configured for email sending
- [ ] Admin team notified of migration start time
- [ ] Downtime window scheduled (if needed)

### Step 4: Execute Migration
1. Upload the full WordPress user CSV
2. Run "Test CSV Parse" to validate the full dataset
3. Review the user count and preview data
4. Execute "Import WordPress Users"
5. Monitor the import progress and results

### Step 5: Post-Migration Validation
1. **Verify Import Results:**
   - Check total imported vs expected user count
   - Review skipped users (existing accounts)
   - Investigate any import errors

2. **Download Reset Tokens:**
   - Download the password reset tokens CSV
   - Store this file securely for user support
   - This CSV contains direct reset links for all imported users

3. **Spot Check User Accounts:**
   - Manually verify 5-10 random user accounts
   - Confirm email addresses, usernames, and registration dates
   - Test password reset functionality

### Step 6: User Communication Strategy

#### Option A: Bulk Email with Reset Links
1. Use the downloaded CSV to send personalized emails
2. Include the direct reset URL for each user
3. Provide instructions for accessing the new system

#### Option B: Individual Reset Emails
1. Use the admin panel's "Send Password Reset Emails" feature
2. Select users in batches to avoid overwhelming the email system
3. Send emails in smaller groups (50-100 at a time)

## Phase 3: Stripe Subscription Matching (If Applicable)

### Prerequisites
- Stripe integration must be configured
- Users must have existing Stripe customer records

### Execution
1. After user migration is complete
2. Run the Stripe subscription matching process
3. This will link imported users to their existing Stripe subscriptions
4. Monitor the matching results for any discrepancies

## Troubleshooting Guide

### Common Issues

#### CSV Parsing Errors
- **Issue:** "No users found" despite valid CSV
- **Solution:** Check CSV format, ensure headers are in first row, verify delimiter

#### Import Errors
- **Issue:** Users showing in "errors" section
- **Solution:** Check for duplicate emails, invalid characters, or missing required fields

#### Email Delivery Issues
- **Issue:** Password reset emails not sending
- **Solution:** Verify SMTP configuration, check email queue, review email templates

#### Login Issues Post-Migration
- **Issue:** Users cannot login after password reset
- **Solution:** Verify password reset token is cleared after use, check user account status

### Emergency Rollback Procedure
1. Stop the migration process immediately
2. Restore database from backup
3. Review logs to identify the issue
4. Fix the problem before retrying migration

## Post-Migration Monitoring

### Week 1
- Monitor user login success rates
- Track password reset requests
- Respond to user support tickets promptly
- Collect feedback on migration process

### Week 2-4
- Continue monitoring user adoption
- Address any remaining migration issues
- Document lessons learned
- Update migration procedures if needed

## Security Considerations

1. **Password Reset Tokens:**
   - Tokens are single-use only
   - Store the reset token CSV securely
   - Tokens should be used within a reasonable timeframe

2. **Data Privacy:**
   - Ensure CSV files are handled securely
   - Delete temporary files after migration
   - Follow GDPR/privacy regulations for user data

3. **Access Control:**
   - Only authorized admins should perform migration
   - Log all migration activities
   - Monitor for suspicious login attempts post-migration

## Support Documentation for Users

### Email Template for Users
```
Subject: Your Account Has Been Migrated to New System

Dear [Username],

Your WordPress account has been successfully migrated to our new platform. To access your account:

1. Click this link to set your new password: [RESET_URL]
2. Create a secure password
3. Login with your email: [EMAIL]

If you experience any issues, please contact our support team.

Best regards,
HAYC Team
```

### FAQ for Common User Questions
- **Q: Why do I need to reset my password?**
  A: For security reasons, passwords are not migrated. You'll need to create a new one.

- **Q: Will my subscription information be preserved?**
  A: Yes, if you have an active Stripe subscription, it will be automatically linked to your new account.

- **Q: What if I don't receive the password reset email?**
  A: Check your spam folder, or contact support for assistance.

## Migration Checklist

### Pre-Migration
- [ ] Test migration completed successfully
- [ ] Database backup created
- [ ] CSV file validated
- [ ] SMTP configuration verified
- [ ] Team notified of migration schedule

### During Migration
- [ ] CSV uploaded and parsed successfully
- [ ] Import executed without critical errors
- [ ] User count verified
- [ ] Reset tokens downloaded and secured

### Post-Migration
- [ ] Spot checks completed
- [ ] User communication sent
- [ ] Monitoring systems active
- [ ] Support team briefed
- [ ] Documentation updated

## Contact Information
- **Technical Lead:** [Name]
- **Database Administrator:** [Name]
- **Support Team:** [Email]
- **Emergency Contact:** [Phone]

---

**Last Updated:** [Date]
**Version:** 1.0
**Reviewed By:** [Name]

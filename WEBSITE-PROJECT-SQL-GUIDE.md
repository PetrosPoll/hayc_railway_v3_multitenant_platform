# Website Project SQL Guide

This guide provides SQL queries to manually create website projects for migrated users.

## Prerequisites

You need to know:
- User's email address
- Business/project name
- Current stage (1-6)
- (Optional) Existing domain name

## Step-by-Step Process

### Step 1: Find User ID by Email

First, look up the user's ID:

```sql
SELECT id, email, username, stripe_customer_id 
FROM users 
WHERE email = 'user@example.com';
```

Note the `id` - you'll need it for the next step.

### Step 2: Create Website Project

Insert a new website_progress entry:

```sql
INSERT INTO website_progress (
  user_id,
  domain,
  project_name,
  current_stage,
  created_at,
  updated_at
) VALUES (
  123,                    -- Replace with user_id from Step 1
  'hayc-abc12345',       -- Unique domain identifier (see below)
  'My Business Name',    -- Business/project name
  6,                     -- Current stage (1-6, use 6 for completed)
  NOW(),
  NOW()
) RETURNING id, domain, project_name;
```

**Domain Identifier Format:**
- Must be unique across all projects
- Format: `hayc-` followed by 8 random characters
- Example: `hayc-k7m9p2x4`, `hayc-b3n8q5w1`
- Used for internal tracking and analytics

**Current Stage Values:**
- 1 = Welcome & Project Setup
- 2 = Layout Selection
- 3 = Content Collection & Organization
- 4 = First Demo Preview
- 5 = Feedback & Refinements
- 6 = Website Launch (completed)

### Step 2.5: Create Website Stages (REQUIRED)

**IMPORTANT:** This step is required or you'll see NaN% in the progress display!

After creating the website_progress entry, you must create the individual stage records:

```sql
INSERT INTO website_stages (
  website_progress_id,
  stage_number,
  title,
  description,
  status,
  completed_at
) VALUES
  -- Stage 1: Welcome & Project Setup
  (456, 1, 'Welcome & Project Setup', 
   'Welcome to hayc! We get started right away by setting up your project and preparing everything for a smooth start',
   'completed', NOW()),
  
  -- Stage 2: Layout Selection
  (456, 2, 'Layout Selection',
   'We pick the best layout for your website, based on your preferences or examples you''ve shared with us',
   'completed', NOW()),
  
  -- Stage 3: Content Collection & Organization
  (456, 3, 'Content Collection & Organization',
   'We organize the information you provide (via our form or email) and spread your content across the chosen layout',
   'completed', NOW()),
  
  -- Stage 4: First Demo Preview
  (456, 4, 'First Demo Preview',
   'Your website draft is ready! You receive a private link to review and give us your feedback',
   'completed', NOW()),
  
  -- Stage 5: Feedback & Refinements
  (456, 5, 'Feedback & Refinements',
   'We make any quick changes or adjustments based on your feedback to make sure everything feels right',
   'completed', NOW()),
  
  -- Stage 6: Website Launch
  (456, 6, 'Website Launch',
   'Your website goes live and is ready for your business!',
   'completed', NOW());
```

**Replace `456` with the actual `website_progress_id` from Step 2!**

**Status Values:**
- `pending` - Not started yet
- `in-progress` - Currently working on this stage
- `completed` - Stage is finished (set `completed_at` to NOW())

**For websites still in progress:**
If the website is NOT completed (current_stage < 6), adjust the status values:

```sql
-- Example: Website at stage 3 (Content Collection)
INSERT INTO website_stages (website_progress_id, stage_number, title, description, status, completed_at) VALUES
  (456, 1, 'Welcome & Project Setup', '...', 'completed', NOW()),
  (456, 2, 'Layout Selection', '...', 'completed', NOW()),
  (456, 3, 'Content Collection & Organization', '...', 'in-progress', NULL),
  (456, 4, 'First Demo Preview', '...', 'pending', NULL),
  (456, 5, 'Feedback & Refinements', '...', 'pending', NULL),
  (456, 6, 'Website Launch', '...', 'pending', NULL);
```

### Step 3: Link Subscription to Website (Optional)

If the user has an active subscription, link it to their website project:

```sql
-- First, find the user's subscription
SELECT id, stripe_subscription_id, tier, status, website_progress_id
FROM subscriptions
WHERE user_id = 123;  -- Replace with user_id

-- Then update it to link to the website project
UPDATE subscriptions
SET website_progress_id = 456  -- Replace with website_progress id from Step 2
WHERE id = 789;  -- Replace with subscription id
```

## Complete Example

Here's a complete example for user `john@example.com` with a completed website:

```sql
-- 1. Look up user
SELECT id, email, username, stripe_customer_id 
FROM users 
WHERE email = 'john@example.com';
-- Result: id = 42

-- 2. Create website project
INSERT INTO website_progress (
  user_id,
  domain,
  project_name,
  current_stage,
  created_at,
  updated_at
) VALUES (
  42,
  'hayc-x7k2m9p5',
  'John Doe Consulting',
  6,  -- Stage 6 = completed
  NOW(),
  NOW()
) RETURNING id, domain, project_name;
-- Result: id = 15

-- 2.5. Create website stages (REQUIRED!)
INSERT INTO website_stages (website_progress_id, stage_number, title, description, status, completed_at) VALUES
  (15, 1, 'Welcome & Project Setup', 
   'Welcome to hayc! We get started right away by setting up your project and preparing everything for a smooth start',
   'completed', NOW()),
  (15, 2, 'Layout Selection',
   'We pick the best layout for your website, based on your preferences or examples you''ve shared with us',
   'completed', NOW()),
  (15, 3, 'Content Collection & Organization',
   'We organize the information you provide (via our form or email) and spread your content across the chosen layout',
   'completed', NOW()),
  (15, 4, 'First Demo Preview',
   'Your website draft is ready! You receive a private link to review and give us your feedback',
   'completed', NOW()),
  (15, 5, 'Feedback & Refinements',
   'We make any quick changes or adjustments based on your feedback to make sure everything feels right',
   'completed', NOW()),
  (15, 6, 'Website Launch',
   'Your website goes live and is ready for your business!',
   'completed', NOW());

-- 3. Link subscription (if exists)
SELECT id FROM subscriptions WHERE user_id = 42;
-- Result: id = 28

UPDATE subscriptions
SET website_progress_id = 15
WHERE id = 28;
```

## Bulk Import Template

For multiple projects, you can use this template:

```sql
-- Insert multiple projects at once
INSERT INTO website_progress (user_id, domain, project_name, current_stage, created_at, updated_at)
VALUES 
  (42, 'hayc-x7k2m9p5', 'John Doe Consulting', 6, NOW(), NOW()),
  (43, 'hayc-b3n8q5w1', 'ABC Corp', 5, NOW(), NOW()),
  (44, 'hayc-k7m9p2x4', 'XYZ Services', 6, NOW(), NOW())
RETURNING id, user_id, domain, project_name;

-- IMPORTANT: After bulk insert, you MUST create stages for each website!
-- For website_progress_id = 15 (from first row):
INSERT INTO website_stages (website_progress_id, stage_number, title, description, status, completed_at) VALUES
  (15, 1, 'Welcome & Project Setup', 'Welcome to hayc! We get started right away by setting up your project and preparing everything for a smooth start', 'completed', NOW()),
  (15, 2, 'Layout Selection', 'We pick the best layout for your website, based on your preferences or examples you''ve shared with us', 'completed', NOW()),
  (15, 3, 'Content Collection & Organization', 'We organize the information you provide (via our form or email) and spread your content across the chosen layout', 'completed', NOW()),
  (15, 4, 'First Demo Preview', 'Your website draft is ready! You receive a private link to review and give us your feedback', 'completed', NOW()),
  (15, 5, 'Feedback & Refinements', 'We make any quick changes or adjustments based on your feedback to make sure everything feels right', 'completed', NOW()),
  (15, 6, 'Website Launch', 'Your website goes live and is ready for your business!', 'completed', NOW());

-- Repeat for website_progress_id = 16, 17, etc.
```

## Utility Queries

### Generate Unique Domain Identifier

Check if a domain identifier is already in use:

```sql
SELECT domain 
FROM website_progress 
WHERE domain = 'hayc-x7k2m9p5';
-- If returns no rows, the identifier is available
```

### View User's Complete Setup

See everything for a user:

```sql
SELECT 
  u.id as user_id,
  u.email,
  u.username,
  u.stripe_customer_id,
  wp.id as website_id,
  wp.domain,
  wp.project_name,
  wp.current_stage,
  s.id as subscription_id,
  s.tier,
  s.status as subscription_status
FROM users u
LEFT JOIN website_progress wp ON wp.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email = 'user@example.com';
```

### Find Users Without Website Projects

Find migrated users who need projects created:

```sql
SELECT 
  u.id,
  u.email,
  u.username,
  u.created_at
FROM users u
LEFT JOIN website_progress wp ON wp.user_id = u.id
WHERE wp.id IS NULL
ORDER BY u.created_at DESC;
```

### Find Subscriptions Not Linked to Websites

```sql
SELECT 
  s.id as subscription_id,
  u.email,
  s.tier,
  s.status,
  s.website_progress_id
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.website_progress_id IS NULL;
```

## Tips

1. **Generate unique domain identifiers** - Use a random string generator or ensure no duplicates exist
2. **Set appropriate stage** - Most completed sites should be stage 6
3. **Don't forget Step 2.5!** - Always create the website_stages records or you'll get NaN% progress
4. **Link subscriptions** - Always link active subscriptions to their website projects
5. **Verify before committing** - Use `SELECT` queries to verify data before `INSERT`/`UPDATE`
6. **Use transactions** - Wrap multiple operations in BEGIN/COMMIT for safety:

```sql
BEGIN;

-- Your INSERT/UPDATE queries here

-- Check results before committing
SELECT * FROM website_progress WHERE user_id = 42;

-- If everything looks good:
COMMIT;
-- If something is wrong:
-- ROLLBACK;
```

## Common Issues

**Issue: NaN% completed in admin dashboard**
```
Progress shows NaN% and no stages visible
```
Solution: You forgot Step 2.5! You must create the website_stages records. See Step 2.5 above.

**Issue: Duplicate domain identifier**
```
ERROR: duplicate key value violates unique constraint
```
Solution: Generate a new unique domain identifier and try again.

**Issue: User ID doesn't exist**
```
ERROR: foreign key constraint violation
```
Solution: Verify the user exists in the users table first.

**Issue: Subscription already linked**
If you try to link a subscription that's already linked to another website, you may need to unlink it first or create a new subscription entry.

**Issue: Fix existing website with missing stages**
If you already created a website_progress entry without stages, you can fix it:

```sql
-- Find the website_progress_id
SELECT id FROM website_progress WHERE user_id = 42;
-- Result: id = 15

-- Then run the INSERT from Step 2.5 using that id
INSERT INTO website_stages (website_progress_id, stage_number, title, description, status, completed_at) VALUES
  (15, 1, 'Welcome & Project Setup', '...', 'completed', NOW()),
  -- ... rest of stages
```

import { db } from '../db';
import {
  contacts,
  tags,
  contactTags,
  newsletterGroups,
  newsletterSubscribers,
} from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function migrateGroupsToTags(websiteProgressId?: number) {
  console.log('🚀 Starting migration from groups to tags system...');

  try {
    // Step 1: Migrate groups to tags
    console.log('📋 Step 1: Migrating groups to tags...');
    const groupsToMigrate = websiteProgressId
      ? await db.select().from(newsletterGroups).where(eq(newsletterGroups.websiteProgressId, websiteProgressId))
      : await db.select().from(newsletterGroups);

    for (const group of groupsToMigrate) {
      // Check if tag already exists
      const existingTag = await db
        .select()
        .from(tags)
        .where(
          sql`${tags.name} = ${group.name} AND ${tags.websiteProgressId} = ${group.websiteProgressId}`
        )
        .limit(1);

      if (existingTag.length === 0) {
        await db.insert(tags).values({
          websiteProgressId: group.websiteProgressId,
          name: group.name,
          description: group.description || undefined,
          color: group.color || 'bg-blue-100 text-blue-800',
          isSystem: false,
        });
        console.log(`  ✓ Migrated group "${group.name}" to tag`);
      } else {
        console.log(`  ⊘ Tag "${group.name}" already exists, skipping`);
      }
    }

    // Step 2: Create default system tags (Subscribed, Unsubscribed)
    console.log('📋 Step 2: Creating system tags...');
    // Get ALL unique website IDs from both groups and subscribers to ensure every website gets system tags
    const groupWebsites = groupsToMigrate.map(g => g.websiteProgressId).filter(id => id !== null && id !== undefined);
    const subscriberWebsites = (websiteProgressId
      ? await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.websiteProgressId, websiteProgressId))
      : await db.select().from(newsletterSubscribers)
    ).map((s: any) => s.websiteProgressId).filter((id: number | null | undefined) => id !== null && id !== undefined);
    
    const websitesToProcess = websiteProgressId
      ? [websiteProgressId]
      : Array.from(new Set([...groupWebsites, ...subscriberWebsites]));

    for (const wpId of websitesToProcess) {
      // Create "Subscribed" tag
      const subscribedTagExists = await db
        .select()
        .from(tags)
        .where(sql`${tags.name} = 'Subscribed' AND ${tags.websiteProgressId} = ${wpId}`)
        .limit(1);

      if (subscribedTagExists.length === 0) {
        await db.insert(tags).values({
          websiteProgressId: wpId,
          name: 'Subscribed',
          description: 'Active newsletter subscribers',
          color: 'bg-green-100 text-green-800',
          isSystem: true,
        });
        console.log(`  ✓ Created "Subscribed" system tag for website ${wpId}`);
      }

      // Create "Unsubscribed" tag
      const unsubscribedTagExists = await db
        .select()
        .from(tags)
        .where(sql`${tags.name} = 'Unsubscribed' AND ${tags.websiteProgressId} = ${wpId}`)
        .limit(1);

      if (unsubscribedTagExists.length === 0) {
        await db.insert(tags).values({
          websiteProgressId: wpId,
          name: 'Unsubscribed',
          description: 'Unsubscribed contacts (do not email)',
          color: 'bg-gray-100 text-gray-800',
          isSystem: true,
        });
        console.log(`  ✓ Created "Unsubscribed" system tag for website ${wpId}`);
      }
    }

    // Step 3: Migrate subscribers to contacts
    console.log('📋 Step 3: Migrating subscribers to contacts...');
    const subscribersToMigrate = websiteProgressId
      ? await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.websiteProgressId, websiteProgressId))
      : await db.select().from(newsletterSubscribers);

    // Filter out subscribers without a valid websiteProgressId
    const validSubscribers = subscribersToMigrate.filter((s: any) => s.websiteProgressId !== null && s.websiteProgressId !== undefined);
    if (validSubscribers.length < subscribersToMigrate.length) {
      console.log(`  ⚠ Skipped ${subscribersToMigrate.length - validSubscribers.length} subscribers with invalid website IDs`);
    }

    // Group subscribers by email + websiteProgressId (to handle duplicates)
    const subscriberMap = new Map<string, typeof subscribersToMigrate>();

    for (const subscriber of validSubscribers) {
      const key = `${subscriber.email}_${subscriber.websiteProgressId}`;
      if (!subscriberMap.has(key)) {
        subscriberMap.set(key, []);
      }
      subscriberMap.get(key)!.push(subscriber);
    }

    // Create contacts and assign tags
    for (const [key, subscribers] of Array.from(subscriberMap.entries())) {
      const primarySubscriber = subscribers[0]; // Use first occurrence as primary
      const allGroupNames = subscribers.map((s: typeof subscribersToMigrate[0]) => s.groupName);

      // Check if contact already exists
      const existingContact = await db
        .select()
        .from(contacts)
        .where(
          sql`${contacts.email} = ${primarySubscriber.email} AND ${contacts.websiteProgressId} = ${primarySubscriber.websiteProgressId}`
        )
        .limit(1);

      let contactId: number;

      if (existingContact.length === 0) {
        // Create new contact with proper defaults and unsubscribed handling
        const isUnsubscribed = primarySubscriber.status === 'unsubscribed';
        const [newContact] = await db
          .insert(contacts)
          .values({
            websiteProgressId: primarySubscriber.websiteProgressId,
            name: primarySubscriber.name || primarySubscriber.email.split('@')[0], // Use email prefix if name is null
            email: primarySubscriber.email,
            status: primarySubscriber.status || 'pending',
            confirmationToken: primarySubscriber.confirmationToken || undefined,
            confirmedAt: primarySubscriber.confirmedAt || undefined,
            subscribedAt: primarySubscriber.subscribedAt || undefined,
            unsubscribedAt: isUnsubscribed ? new Date() : undefined,
          })
          .returning();

        contactId = newContact.id;
        console.log(`  ✓ Created contact: ${primarySubscriber.email}`);
      } else {
        contactId = existingContact[0].id;
        console.log(`  ⊘ Contact ${primarySubscriber.email} already exists`);
      }

      // Assign tags based on group membership
      for (const groupName of allGroupNames) {
        // Find or create the tag for this group (handles orphaned group references)
        let tag = await db
          .select()
          .from(tags)
          .where(
            sql`${tags.name} = ${groupName} AND ${tags.websiteProgressId} = ${primarySubscriber.websiteProgressId}`
          )
          .limit(1)
          .then(results => results[0]);

        if (!tag) {
          // Create missing tag for orphaned group reference
          console.log(`    ⚠ Creating missing tag for group "${groupName}"`);
          const [newTag] = await db.insert(tags).values({
            websiteProgressId: primarySubscriber.websiteProgressId,
            name: groupName,
            description: `Migrated from legacy group`,
            color: 'bg-gray-100 text-gray-800',
            isSystem: false,
          }).returning();
          tag = newTag;
        }

        // Check if tag assignment already exists
        const existingAssignment = await db
          .select()
          .from(contactTags)
          .where(
            sql`${contactTags.contactId} = ${contactId} AND ${contactTags.tagId} = ${tag.id}`
          )
          .limit(1);

        if (existingAssignment.length === 0) {
          await db.insert(contactTags).values({
            contactId,
            tagId: tag.id,
          });
          console.log(`    → Assigned tag "${groupName}" to ${primarySubscriber.email}`);
        }
      }

      // Assign "Subscribed" or "Unsubscribed" system tag based on status
      // Use 'Subscribed' for confirmed/pending statuses, 'Unsubscribed' for unsubscribed status
      const systemTagName = (primarySubscriber.status === 'confirmed' || primarySubscriber.status === 'pending') 
        ? 'Subscribed' 
        : 'Unsubscribed';
      const [systemTag] = await db
        .select()
        .from(tags)
        .where(
          sql`${tags.name} = ${systemTagName} AND ${tags.websiteProgressId} = ${primarySubscriber.websiteProgressId}`
        )
        .limit(1);

      if (systemTag) {
        const existingSystemTag = await db
          .select()
          .from(contactTags)
          .where(
            sql`${contactTags.contactId} = ${contactId} AND ${contactTags.tagId} = ${systemTag.id}`
          )
          .limit(1);

        if (existingSystemTag.length === 0) {
          await db.insert(contactTags).values({
            contactId,
            tagId: systemTag.id,
          });
          console.log(`    → Assigned system tag "${systemTagName}" to ${primarySubscriber.email}`);
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log(`   - Migrated ${groupsToMigrate.length} groups to tags`);
    console.log(`   - Processed ${subscriberMap.size} unique contacts`);
    console.log(`   - Total subscriber records: ${subscribersToMigrate.length}`);

    return {
      success: true,
      groupsMigrated: groupsToMigrate.length,
      contactsCreated: subscriberMap.size,
      totalSubscriberRecords: subscribersToMigrate.length,
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Command-line execution - check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const websiteProgressId = process.argv[2] ? parseInt(process.argv[2]) : undefined;

  if (websiteProgressId) {
    console.log(`Running migration for website progress ID: ${websiteProgressId}`);
  } else {
    console.log('Running migration for ALL websites');
  }

  migrateGroupsToTags(websiteProgressId)
    .then((result) => {
      console.log('\n📊 Migration Summary:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

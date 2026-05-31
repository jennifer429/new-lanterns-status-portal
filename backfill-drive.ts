import { requireDb } from "./server/db";
import { intakeFileAttachments, partnerDocuments, fileAttachments, orgNotes } from "./drizzle/schema";
import { eq, isNotNull, isNull, or, like, notLike } from "drizzle-orm";
import { uploadToGoogleDrive } from "./server/routers/files";
import { storageGet } from "./server/storage";


async function backfill() {
  console.log("Starting Google Drive backfill...");
  const db = await requireDb();
  
  // 1. Intake files
  const intakeFiles = await db.select().from(intakeFileAttachments)
    .where(notLike(intakeFileAttachments.fileUrl, '%drive.google.com%'));
    
  console.log(`Found ${intakeFiles.length} intake files to backfill`);
  
  for (const file of intakeFiles) {
    try {
      console.log(`Processing intake file: ${file.fileName}`);
      
      // Get file from S3
      const s3Url = file.fileUrl;
      const response = await fetch(s3Url);
      if (!response.ok) {
        console.error(`Failed to fetch from S3: ${s3Url}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Drive
      const result = await uploadToGoogleDrive(
        file.fileName,
        buffer,
        file.organizationSlug || 'unknown-org'
      );
      
      if (result.driveUrl && typeof result.driveUrl === 'string') {
        // Update DB
        await db.update(intakeFileAttachments)
          .set({ fileUrl: result.driveUrl, driveFileId: result.driveFileId || null })
          .where(eq(intakeFileAttachments.id, file.id));
        console.log(`Successfully backfilled ${file.fileName} to Drive`);
      } else {
        console.error(`Failed to upload ${file.fileName} to Drive`);
      }
    } catch (e) {
      console.error(`Error processing ${file.fileName}:`, e);
    }
  }
  
  // 2. Partner documents
  const partnerDocs = await db.select().from(partnerDocuments)
    .where(notLike(partnerDocuments.url, '%drive.google.com%'));
    
  console.log(`Found ${partnerDocs.length} partner documents to backfill`);
  
  for (const doc of partnerDocs) {
    try {
      console.log(`Processing partner doc: ${doc.filename}`);
      
      // Get file from S3
      const s3Url = doc.url;
      const response = await fetch(s3Url);
      if (!response.ok) {
        console.error(`Failed to fetch from S3: ${s3Url}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Drive
      const result = await uploadToGoogleDrive(
        doc.filename,
        buffer,
        'partner-documents'
      );
      
      if (result.driveUrl && typeof result.driveUrl === 'string') {
        // Update DB
        await db.update(partnerDocuments)
          .set({ url: result.driveUrl, driveFileId: result.driveFileId || null })
          .where(eq(partnerDocuments.id, doc.id));
        console.log(`Successfully backfilled ${doc.filename} to Drive`);
      } else {
        console.error(`Failed to upload ${doc.filename} to Drive`);
      }
    } catch (e) {
      console.error(`Error processing ${doc.filename}:`, e);
    }
  }
  
  // 3. Org notes
  const notes = await db.select().from(orgNotes)
    .where(notLike(orgNotes.fileUrl, '%drive.google.com%'));
    
  console.log(`Found ${notes.length} org notes to backfill`);
  
  for (const note of notes) {
    if (!note.fileUrl) continue;
    
    try {
      console.log(`Processing org note: ${note.fileName}`);
      
      // Get file from S3
      const s3Url = note.fileUrl;
      const response = await fetch(s3Url);
      if (!response.ok) {
        console.error(`Failed to fetch from S3: ${s3Url}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Drive
      const result = await uploadToGoogleDrive(
        note.fileName || 'note-attachment',
        buffer,
        note.organizationSlug || 'unknown-org'
      );
      
      if (result.driveUrl && typeof result.driveUrl === 'string') {
        // Update DB
        await db.update(orgNotes)
          .set({ fileUrl: result.driveUrl, driveFileId: result.driveFileId || null })
          .where(eq(orgNotes.id, note.id));
        console.log(`Successfully backfilled ${note.fileName} to Drive`);
      } else {
        console.error(`Failed to upload ${note.fileName} to Drive`);
      }
    } catch (e) {
      console.error(`Error processing ${note.fileName}:`, e);
    }
  }
  
  console.log("Backfill complete!");
}

backfill().catch(console.error);

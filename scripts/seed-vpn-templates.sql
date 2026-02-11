-- Seed script: Migrate hardcoded VPN template URLs into the partnerTemplates table
-- Run this AFTER running `pnpm run db:push` to create the partnerTemplates table
--
-- These URLs were previously hardcoded in shared/questionnaireData.ts on question E.1
-- Now they are managed via the Templates tab in the admin dashboard

-- RadOne VPN Configuration Form (clientId = 1)
INSERT INTO partner_templates (client_id, question_id, label, file_name, file_url, s3_key, file_size, uploaded_by, is_active, created_at, updated_at)
VALUES (
  1,
  'E.1',
  'VPN Configuration Form - RadOne',
  'VPN-Configuration-Form-RadOne.xlsx',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663326227304/NfNtZiMfXpqdbVqa.xlsx',
  'legacy/VPN-Configuration-Form-RadOne.xlsx',
  0,
  'system-migration',
  1,
  NOW(),
  NOW()
);

-- SRV VPN Configuration Form (clientId = 2)
INSERT INTO partner_templates (client_id, question_id, label, file_name, file_url, s3_key, file_size, uploaded_by, is_active, created_at, updated_at)
VALUES (
  2,
  'E.1',
  'VPN Configuration Form - SRV',
  'VPN-Configuration-Form-SRV.docx',
  'https://files.manuscdn.com/user_upload_by_module/session_file/310519663326227304/MFEsljZLLtNyBZWF.docx',
  'legacy/VPN-Configuration-Form-SRV.docx',
  0,
  'system-migration',
  1,
  NOW(),
  NOW()
);

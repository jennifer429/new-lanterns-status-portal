-- ============================================================================
-- PHASE 3 — P1 Foreign Keys (MySQL-owned tables)
-- ============================================================================
-- Eliminates orphans permanently. Medium risk: writes that previously
-- "succeeded with a dangling reference" will now throw. Ensure the dual-write,
-- import, and cron paths handle FK rejection before enabling in production.
--
-- NOT included by design:
--   • contacts / systems  — Notion is the source of truth; sync ordering can
--     transiently violate an FK. Guarded by the scheduled data-quality check.
--   • partnerDocuments.categoryId — references partnerDocCategories, which has
--     no table defined in the schema.
--   • audit tables (aiAuditLogs, vendorAuditLog, emailLog, partnerDocAudit.userId)
--     — left FK-free so history survives parent deletion (denormalized fields kept).
--
-- PREREQUISITE: `node scripts/data-quality-check.mjs` must report 0 FAIL in §1.
-- A FK CANNOT be added while orphan rows exist — it will error:
--   ERROR 1452 (23000): Cannot add or update a child row: a foreign key constraint fails
-- Requires InnoDB (the default). FK column + referenced column types must match.
-- ----------------------------------------------------------------------------

-- ---- Hierarchy: client / organization parents ------------------------------
ALTER TABLE users         ADD CONSTRAINT fk_users_client FOREIGN KEY (clientId)       REFERENCES clients(id)       ON DELETE SET NULL;
ALTER TABLE users         ADD CONSTRAINT fk_users_org    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD CONSTRAINT fk_org_client  FOREIGN KEY (clientId)       REFERENCES clients(id)       ON DELETE RESTRICT;

-- ---- Org-scoped child data (delete the org → delete its data) --------------
ALTER TABLE responses            ADD CONSTRAINT fk_responses_org    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE sectionProgress      ADD CONSTRAINT fk_section_org      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE taskCompletion       ADD CONSTRAINT fk_taskcompletion_org FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE fileAttachments      ADD CONSTRAINT fk_fileatt_org      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE validationResults    ADD CONSTRAINT fk_validation_org   FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE intakeResponses      ADD CONSTRAINT fk_intake_org       FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE intakeFileAttachments ADD CONSTRAINT fk_intakefile_org  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE activityFeed         ADD CONSTRAINT fk_activity_org     FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE onboardingFeedback   ADD CONSTRAINT fk_feedback_org     FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE orgCustomTasks       ADD CONSTRAINT fk_customtask_org   FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE implementationOrgs   ADD CONSTRAINT fk_implorg_org      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE taskOrgAssignment    ADD CONSTRAINT fk_taskorg_org      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE taskOrgAssignment    ADD CONSTRAINT fk_taskorg_implorg  FOREIGN KEY (implOrgId)      REFERENCES implementationOrgs(id) ON DELETE CASCADE;

-- ---- Question references ----------------------------------------------------
ALTER TABLE responses        ADD CONSTRAINT fk_responses_question FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE;
ALTER TABLE question_options ADD CONSTRAINT fk_qoption_question   FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE;

-- ---- Partner-scoped data ----------------------------------------------------
ALTER TABLE partnerTemplates     ADD CONSTRAINT fk_ptemplate_client     FOREIGN KEY (clientId)   REFERENCES clients(id)          ON DELETE CASCADE;
ALTER TABLE partnerTaskTemplates ADD CONSTRAINT fk_ptasktemplate_client FOREIGN KEY (clientId)   REFERENCES clients(id)          ON DELETE CASCADE;
ALTER TABLE partnerDocuments     ADD CONSTRAINT fk_pdoc_client          FOREIGN KEY (clientId)   REFERENCES clients(id)          ON DELETE CASCADE;
ALTER TABLE partnerDocAudit      ADD CONSTRAINT fk_pdocaudit_doc        FOREIGN KEY (documentId) REFERENCES partnerDocuments(id) ON DELETE CASCADE;

-- ---- Misc -------------------------------------------------------------------
ALTER TABLE passwordResetTokens ADD CONSTRAINT fk_pwreset_user FOREIGN KEY (userId)         REFERENCES users(id)         ON DELETE CASCADE;
ALTER TABLE orgNotes            ADD CONSTRAINT fk_orgnote_org  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE orgNotes            ADD CONSTRAINT fk_orgnote_client FOREIGN KEY (clientId)      REFERENCES clients(id)       ON DELETE CASCADE;

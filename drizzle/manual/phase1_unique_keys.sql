-- ============================================================================
-- PHASE 1 — P0 Composite Unique Keys
-- ============================================================================
-- Promotes the logical keys the portal already upserts on into DB-enforced
-- unique indexes. Once applied, double-submit / sync races can no longer create
-- duplicate rows, and the write paths can move to INSERT ... ON DUPLICATE KEY UPDATE.
--
-- PREREQUISITE: `node scripts/data-quality-check.mjs` must report 0 FAIL in §2.
-- A unique index CANNOT be added while duplicates exist — it will error:
--   ERROR 1062 (23000): Duplicate entry '...' for key '...'
--
-- If §2 reports duplicates, de-dupe first. The pattern below keeps the
-- highest id per key (assumed newest). Review the rows before running — this
-- DELETES data. For tables with `updatedAt`, prefer keeping the most-recently
-- updated row (see the variant in README.md).
-- ----------------------------------------------------------------------------

-- ---- De-dup (DESTRUCTIVE — uncomment per table only after reviewing) --------
-- DELETE a FROM intakeResponses   a JOIN intakeResponses   b ON a.organizationId=b.organizationId AND a.questionId=b.questionId   AND a.id<b.id;
-- DELETE a FROM responses         a JOIN responses         b ON a.organizationId=b.organizationId AND a.questionId=b.questionId   AND a.id<b.id;
-- DELETE a FROM taskCompletion    a JOIN taskCompletion    b ON a.organizationId=b.organizationId AND a.taskId=b.taskId           AND a.id<b.id;
-- DELETE a FROM validationResults a JOIN validationResults b ON a.organizationId=b.organizationId AND a.testKey=b.testKey         AND a.id<b.id;
-- DELETE a FROM sectionProgress   a JOIN sectionProgress   b ON a.organizationId=b.organizationId AND a.sectionName=b.sectionName AND a.id<b.id;
-- DELETE a FROM taskOrgAssignment a JOIN taskOrgAssignment b ON a.organizationId=b.organizationId AND a.taskId=b.taskId           AND a.id<b.id;
-- DELETE a FROM question_options  a JOIN question_options  b ON a.questionId=b.questionId          AND a.optionValue=b.optionValue AND a.id<b.id;

-- ---- Add the unique indexes -------------------------------------------------
ALTER TABLE intakeResponses   ADD UNIQUE INDEX uq_intake_org_question     (organizationId, questionId);
ALTER TABLE responses         ADD UNIQUE INDEX uq_responses_org_question  (organizationId, questionId);
ALTER TABLE taskCompletion    ADD UNIQUE INDEX uq_taskcompletion_org_task (organizationId, taskId);
ALTER TABLE validationResults ADD UNIQUE INDEX uq_validation_org_testkey  (organizationId, testKey);
ALTER TABLE sectionProgress   ADD UNIQUE INDEX uq_section_org_name        (organizationId, sectionName);
ALTER TABLE taskOrgAssignment ADD UNIQUE INDEX uq_taskorg_org_task        (organizationId, taskId);
ALTER TABLE question_options  ADD UNIQUE INDEX uq_qoption_question_value  (questionId, optionValue);

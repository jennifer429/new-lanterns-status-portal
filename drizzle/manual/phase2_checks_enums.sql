-- ============================================================================
-- PHASE 2 — P1 CHECK Constraints + Enum Conversions
-- ============================================================================
-- Makes invalid states impossible to insert. Low risk, high payoff.
-- Requires MySQL 8.0.16+ for enforced CHECK constraints.
--
-- PREREQUISITE: run the pre-flight SELECTs below. Each must return 0 rows,
-- otherwise the ALTER will fail (CHECK) or silently coerce bad values (ENUM,
-- which becomes '' under non-strict sql_mode). Clean offending rows first.
-- ----------------------------------------------------------------------------

-- ---- Pre-flight: CHECK violations (each must return 0) ----------------------
-- SELECT COUNT(*) FROM sectionProgress    WHERE progress NOT BETWEEN 0 AND 100;
-- SELECT COUNT(*) FROM taskCompletion     WHERE (completed + notApplicable + inProgress + blocked) > 1;
-- SELECT COUNT(*) FROM onboardingFeedback WHERE rating NOT BETWEEN 1 AND 5;
-- SELECT COUNT(*) FROM orgNotes           WHERE organizationId IS NULL AND clientId IS NULL;

-- ---- Pre-flight: ENUM domain violations (each must return 0) ----------------
-- SELECT DISTINCT `type`      FROM partnerTaskTemplates WHERE `type`      NOT IN ('upload','schedule','form','review');
-- SELECT DISTINCT `type`      FROM orgCustomTasks       WHERE `type`      NOT IN ('upload','schedule','form','review');
-- SELECT DISTINCT `status`    FROM notionRetryQueue     WHERE `status`    NOT IN ('pending','succeeded','failed_permanent');
-- SELECT DISTINCT `status`    FROM reconciliationLog    WHERE `status`    NOT IN ('healthy','issues_found','error');
-- SELECT DISTINCT `direction` FROM emailLog             WHERE `direction` NOT IN ('inbound','outbound');
-- SELECT DISTINCT `status`    FROM emailLog             WHERE `status`    NOT IN ('sent','failed','queued','bounced');

-- ---- CHECK constraints ------------------------------------------------------
ALTER TABLE sectionProgress    ADD CONSTRAINT chk_section_progress_pct  CHECK (progress BETWEEN 0 AND 100);
ALTER TABLE taskCompletion     ADD CONSTRAINT chk_task_status_exclusive CHECK ((completed + notApplicable + inProgress + blocked) <= 1);
ALTER TABLE onboardingFeedback ADD CONSTRAINT chk_feedback_rating      CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE orgNotes           ADD CONSTRAINT chk_orgnote_owner        CHECK (organizationId IS NOT NULL OR clientId IS NOT NULL);

-- ---- Enum conversions (free-text status/type columns) -----------------------
ALTER TABLE partnerTaskTemplates MODIFY COLUMN `type`      ENUM('upload','schedule','form','review')      NOT NULL DEFAULT 'review';
ALTER TABLE orgCustomTasks       MODIFY COLUMN `type`      ENUM('upload','schedule','form','review')      NOT NULL DEFAULT 'review';
ALTER TABLE notionRetryQueue     MODIFY COLUMN `status`    ENUM('pending','succeeded','failed_permanent') NOT NULL DEFAULT 'pending';
ALTER TABLE reconciliationLog    MODIFY COLUMN `status`    ENUM('healthy','issues_found','error')         NOT NULL DEFAULT 'healthy';
ALTER TABLE emailLog             MODIFY COLUMN `direction` ENUM('inbound','outbound')                     NOT NULL;
ALTER TABLE emailLog             MODIFY COLUMN `status`    ENUM('sent','failed','queued','bounced')       NOT NULL DEFAULT 'sent';

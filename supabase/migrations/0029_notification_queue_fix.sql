-- 0029: notification_log was born with sent_at NOT NULL DEFAULT now(),
-- while flushNotifications drains rows WHERE sent_at IS NULL — so every
-- enqueued notification arrived pre-marked as sent and the queue never
-- drained. Invisible until now because Resend was never verified (DNS),
-- so no email could have gone out either way.
--
-- Deliberate choice: existing rows KEEP their sent_at. They include the
-- dunning ladder history for parties now under payment plans / litigation;
-- un-marking them would fire months of stale legal reminders the moment
-- email goes live. History stays frozen; only rows enqueued after this
-- migration are flushable.

alter table notification_log alter column sent_at drop default;
alter table notification_log alter column sent_at drop not null;

-- Status now reflects queue truth for new rows ('pending' until flushed).
alter table notification_log alter column status set default 'pending';

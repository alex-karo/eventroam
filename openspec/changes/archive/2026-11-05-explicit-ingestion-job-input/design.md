# Design

## Change size

Small. The change affects stored jobs and the SQL used to inspect them. The Studio workflow input and the batch inspection examples also change.

## Approach

Store the job mode in `mode` and its input as JSON in `input`. Add stores a JSON string with the full note. Refresh stores an object with `eventId` and `scope`. The application validates the input for the saved mode at dispatch and when it starts an attempt. The job keeps its own queue state and preview setting. The workflow form uses the same target shape. Refresh scope defaults to full in the form and stays fixed after a job is accepted.

Migration 0005 converts both job shapes to the new format in place, makes the two new columns required, and removes the old columns. Databases that already ran 0004 only need 0005. Test upgrades from 0003 and 0004 with saved jobs, indexes, and linked runs.

Use separate SQL queries for queue counts and job details. The details query returns a short note excerpt for add. Studio owns the queue loop. After restart, it starts each interrupted job again from the beginning.

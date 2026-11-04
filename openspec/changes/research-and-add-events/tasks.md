# Tasks

## 1. Accept free text in add

- [x] 1.1 Replace the add input across the CLI, workflow schema, private run input, and their callers. Update the CLI help and the examples in the ingestion tools guide. Check name-only, URL-only, and blank input at both entry points. Verify the last line of a multiline note over 500 characters reaches private history and the collector. Check that an input-size failure is explicit.
- [x] 1.2 Pass the complete note to source collection and remove name assumptions from assignments, trace labels, and eval inputs. Use a fixture with a tentative name and a conflicting source date to check that the note reaches discovery and that the report uses source evidence.
- [x] 1.3 Verify with a source collection fixture that a map page echoing an owner pin stays a lead. With only a confirmed city and a valid city point, check for locality precision. With no supported place or point, check for empty coordinates. Document these outcomes in the ingestion process guide.

## 2. Process add jobs in the existing queue

- [x] 2.1 Migrate SQLite to the two job shapes in the design. Validate both shapes in application code and reject mixed or incomplete rows. Run the migration on a catalog with queued refresh jobs and linked runs. Verify the links, settings, order, and foreign keys after migration.
- [x] 2.2 Accept add selections atomically and dispatch each stored input through the workflow. Extend queue tests for invalid selections, mismatched job and attempt inputs, independent item outcomes, and a restart after a committed add. Verify that a retry after a committed add skips the duplicate, that both attempts belong to one job, and that refresh jobs still execute.
- [x] 2.3 Update the background execution guide and catalog SQL guidance for both job shapes. Extend the existing batch-count SQL test with add jobs. Check that a queued note survives intact. Verify counts, position, and outcomes for a note larger than the SQL result limit. Read only a short excerpt on request.

## 3. Expose the researcher in Studio

- [x] 3.1 Register the researcher and its web search tool with existing chat resources. Check search failure and budget exhaustion without submission using the offline provider.
- [x] 3.2 Connect batch submission, the per-execution submission guard, and read-only status lookup. Check status with saved report fixtures for proposed creation, committed creation with publication, duplicate skip, declined creation with a reason, and a failed candidate match. Verify that repeated tool calls in one execution cannot create a second batch.
- [x] 3.3 Rename the catalog assistant tool to `cancel_batch` across its registration, instructions, fixtures, and guide. Test both batch types with pending and running jobs. Verify that only pending jobs are cancelled and that the researcher has no cancellation tool.
- [x] 3.4 Add the researcher to the Studio guide. Use one end-to-end offline Studio conversation to find two Events, explicitly add both, and request status with the returned batch ID. Verify candidate links, the acceptance receipt, and progress without new jobs. Check both agents remain available and run the relevant ingestion tests, type checks, docs check, and OpenSpec validation.

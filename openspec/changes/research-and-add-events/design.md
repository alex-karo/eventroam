# Design

## Change size

Large. The change connects two ingestion entry points, chat, source collection, and persistent jobs. The main risks are treating a lead as evidence and losing the link between a queued description and its attempts.

## Approach

The owner can submit one note directly through the CLI or workflow form. In Studio, the researcher can first look for candidates. Once the owner requests an add or preview, the researcher groups the relevant notes by Event and submits the complete selection. Studio returns a batch ID while the existing processor runs the ingestion workflow once per job.

## Contracts

| Entry point | Input | Result |
| --- | --- | --- |
| CLI | `catalog add --input "…"` | Usual single add report |
| Workflow form | `{"mode":"add","input":"…"}` | Usual single add report |
| Researcher tool | `add_events({inputs: string[], dryRun?: boolean})` | `{batchId, acceptedCount}` after commit |
| Chat status request | Batch ID | Full queue counts and requested item results from saved jobs and runs |

Use one shared validator for the add text. Use trimming only to detect blank input. Keep the full note and its line breaks in the assignment and private storage. Remove the 500-character name limit from both workflow and run validation. Surface a processing limit as an error if the complete note does not fit. Replace name-only call sites, fixtures, and help examples together. Use a verified Event name for the catalog. Omit the Event-name trace label until a name is known.

## Source collection and Location

Pass the note directly to the collector. Keep it out of the identity context shared with General and the page reader. The collector can read a supplied public URL or search using a name, place, or other clue. Retain the original note if the chat adds a candidate URL. Use the existing reader, source-access checks, and evidence corpus. General still decides Event identity and duplicate matches.

Location uses inspected evidence and registered points for each Edition. If the organizer confirms the site, Location can use its supported point. If sources confirm only the city, Location can use a point for that city with `locality` precision and keep the venue unresolved. A map link that echoes the supplied pin or a reverse lookup only shows where the pin is. Neither establishes where the festival takes place.

## Studio tools

Register the researcher beside the catalog assistant. Give the researcher search, add submission, and status reads. Replace `cancel_refresh` on the catalog assistant with `cancel_batch({batchId})`. Reuse the existing pending-job update for either batch type. The researcher can direct the owner to the catalog assistant with the batch ID. Reuse Studio chat model selection, conversation memory, and the host submission guard. Expose the existing Exa search adapter through a bounded chat tool. Share the search allowance and deadline across calls in one chat execution. A missing search credential affects search when called. It does not prevent job submission or stored status reads.

Reuse the existing read-only catalog SQL tool and its guidance for status by batch ID. Count jobs before joining attempts. Select item position and state by default. When the owner needs to identify an item by its note, select a short excerpt in SQL so a single note cannot exhaust the 64 KiB output limit.

For each attempt, read the saved preview flag, run Event ID, and supported report fields together. In a preview, a create operation can have a temporary ID. For apply, check the createEvent operation and its changed receipt. The overall outcome can be published when the same run creates and publishes the Event. A duplicate skip identifies an existing Event. A declined creation records a failed attempt with the Editor target rejection and its reason. A whole-item rejection is distinct. A failed identity check can carry a candidate ID. If evidence is missing, report what is known about the attempt.

## Queue and migration

Store one target per job. Add a nullable `add_input` column and make `event_id` and `scope` nullable. Each valid row has one of two shapes:

| Job | add_input | event_id | scope |
| --- | --- | --- | --- |
| Add | Nonblank note | NULL | NULL |
| Refresh | NULL | Existing Event ID | full or current |

One application validator derives the workflow mode from these fields and rejects mixed or incomplete targets. The job table needs no mode column. The run records its mode explicitly. Existing refresh rows gain a null add input. Preserve job IDs, positions, queue states, indexes, and run links during migration.

Use the same mapping for dispatch and the job check in the attempt transaction. Match the stored target and preview flag. Keep republish off. A restart reads the current catalog, so an earlier committed add can produce a duplicate skip on retry.

## Verification

Use one offline Studio conversation to search for two Events, add both, and read status with the returned batch ID. Check restart and duplicate handling in the queue workflow test. Check full batch counts with multiple attempts in the existing storage test.

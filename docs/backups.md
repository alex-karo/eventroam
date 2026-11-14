---
type: Guide
title: Backups and retention
description: Set up daily S3 backups, check recovery, and apply local retention.
status: stable
tags: [operations, backup, storage]
---

# Backups and retention

This repository supplies [scripts/backup.sh](../scripts/backup.sh) and its tests.
The private infrastructure repository supplies the Komodo Action `eventroam-backup`
and the S3 inputs. The application file
[compose.backup.yaml](../compose.backup.yaml) defines the temporary database and restic tasks.
The Action runs daily at **09:00 UTC**.
Deployment and S3 setup are required before it can run. This guide defines the
policy and the activation and recovery steps. Use [Infrastructure](infrastructure.md)
for the application containers and database transfers.

## Policy and scope

| Data | Retention |
| --- | --- |
| S3 snapshots | Every daily snapshot within six calendar months of the latest snapshot. |
| Local trace events | Seven days. |
| Local Mastra logs, metrics, scores, and feedback | 90 days. |
| Workflow snapshots, chat threads and messages, and eval results | 90 days. |
| Source Markdown and evidence | 30 days after the last file write. |
| Docker stdout and stderr | Five files of at most `20m` per application container. |
| Catalog, audit history, and authored eval datasets | No automatic age deletion. |

Age cleanup runs only after a complete backup. Mastra applies its standard
retention rules: workflow snapshots use `updatedAt`; chat threads and messages
each use `createdAt`. Workflow status and new messages in an old thread do not
extend these ages. Eval experiments use `completedAt`, so running experiments remain.
Docker rotation is a size buffer; it does not guarantee 90 days of history.
The 90-day log policy applies to Mastra logs. Recreate containers to apply the
Docker logging options. No log collection service is required.

The backup contains these five files from the `eventroam_data` volume:

| Path | Contents |
| --- | --- |
| `/data/eventroam.sqlite` | Catalog, audit history, and durable ingestion reports. |
| `/data/mastra-workflows.sqlite` | Workflow snapshots. |
| `/data/mastra-chat.sqlite` | Chat history. |
| `/data/mastra-evals.sqlite` | Eval datasets, experiments, and scores. |
| `/data/mastra-observability.duckdb` | Traces and other observation signals. |

It also contains `/data/ingestion-sources/`. Restic records file metadata and
content hashes in its snapshot. The `image=...` snapshot tag records the Studio
image ID. Compose sets the persistent source path explicitly.
Only Eventroam is in scope. Manual transfer copies under `/data/backups/`,
old worker databases, caches, and backup control files are excluded.

Old traces remain in daily DuckDB snapshots. Restic compresses and deduplicates
the data. There is no separate trace export or gzip archive. Keep the daily
snapshots throughout the six-month period; monthly snapshots can miss traces
that were created and removed between snapshots. The snapshot age policy does
not limit the age of records that still exist in a database.

## S3 inputs

Set these Komodo Variables before deploying the updated Eventroam stack:

| Komodo Variable | Deployment input | Value |
| --- | --- | --- |
| `EVENTROAM_S3_BUCKET` | `RESTIC_REPOSITORY` | `s3:https://s3.<region>.amazonaws.com/<bucket>/eventroam`, or the matching S3 endpoint URL. |
| `EVENTROAM_BACKUP_REGION` | `AWS_DEFAULT_REGION` | Bucket region. |
| `EVENTROAM_BACKUP_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | Access key ID; mark it secret. |
| `EVENTROAM_BACKUP_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | Secret key; mark it secret. |

The repository URL includes the endpoint, bucket, and prefix. Give the key
read, list, write, and delete access to this repository prefix. Keep the bucket
private. Do not set an S3 Lifecycle rule that expires repository objects by age:
retained snapshots can share old data. Use an online storage class.

Komodo writes these inputs to `/etc/komodo/stacks/eventroam/.env`. Compose reads
the file without executing it as shell code. Its restic service selects only
the four backup inputs. The host job ignores S3 inputs from its calling shell.
Web, Studio, and the database task do not receive S3 credentials.

The host job starts each task with `docker compose run --rm --no-deps` and removes
it when the command ends. The database task uses the installed Studio image ID,
without a separate image build or network access. Restic mounts the data volume
read-only. These tasks do not run as part of the normal application stack.
The host script needs Bash, `flock`, and Docker Compose with `start --wait`.
It uses `.env` and
`compose.backup.yaml` from its own checkout, regardless of the current directory.
Node.js runs inside the Studio image; the host script does not need it.

The job uses `restic/restic:0.19.1` with `--insecure-no-password` on every command.
There is no separate repository password. Restic still encrypts its internal
format, but anyone with S3 read access to the repository can restore it without
another secret. Leave `RESTIC_PASSWORD`, `RESTIC_PASSWORD_FILE`, and
`RESTIC_PASSWORD_COMMAND` unset when using restic directly. The host wrapper
does not pass these variables.

## Activate the job

1. Set the four Komodo Variables. Apply the infrastructure ResourceSync, then
   deploy Eventroam with `scripts/backup.sh`, `compose.backup.yaml`, and the new
   Studio image. The image must contain `commands/backup.mjs`.
2. On the production host, initialize the selected repository once:

   ```sh
   sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh restic init
   ```

3. Run the first backup. A complete upload also permits local cleanup:

   ```sh
   sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh run
   ```

## Daily operation

The host command locks the project directory `/etc/komodo/stacks/eventroam`.
Eventroam Compose deployments, one-shot commands through the wrapper, and
`db:pull`/`db:push` lock the same directory. Each command opens it read-only;
no lock file or group setup is required. A competing operation fails before it
changes the data. Do not remove or recreate the checkout while a job runs:
a replacement directory would have a separate lock. Do not start unmanaged
database commands or use manual container controls during a job.
Backup output keeps the private `077` umask.

The job follows this sequence:

1. Check the S3 repository and the maintenance command. Require at least 1 GiB
   of free space for WAL and database work. Restic uses no local disk cache.
2. Set `/data/.eventroam-maintenance`. Studio rejects new requests except its
   health and queue status routes. Its queue stops taking jobs. Wait up to one
   hour for active ingestion and write requests, including response streams, to finish. If it
   stays busy, clear the pause and report failure without stopping the services.
3. Stop the running database users. Check SQLite integrity and foreign keys,
   truncate SQLite WAL files, scan all values in DuckDB base tables,
   checkpoint DuckDB, and close all maintenance
   connections. Restart the read-only website after this
   preparation; Studio remains stopped for upload and local cleanup.
4. Back up the stable files directly to S3. No second full local DuckDB copy is
   required. A nonzero restic result, including an incomplete snapshot, skips
   all local cleanup. Only restic exit code `0` permits local cleanup. Restic
   writes its report and snapshot ID directly to the Komodo output.
5. After a complete current backup, prune local data. Mastra prunes
   observation signals independently, workflow snapshots, chat threads
   and messages, eval experiments with their results, and saved scores. Delete
   source files whose last write was more than 30 days ago, then remove empty
   source folders. Checkpoint and check the databases after cleanup.
6. Clear the pause and start services that were running before the job with
   `docker compose start --wait --wait-timeout 120`. This starts the existing
   containers without changing their settings and waits for their health checks.
   Keep a previously stopped Studio stopped. Normal
   failures also restore this service state and report a nonzero result.
   The exit handler retries failed pause cleanup and service starts.
7. Run `forget --keep-within 6m --prune` for the stable `eventroam` host and tag,
   then `restic check`. These operations run after application startup. A failure
   appears in the existing Komodo Action status and logs.

Studio downtime is accepted for the full upload and local cleanup. The first
upload can take longer. The website has a short preparation pause. A daily
backup can lose changes since the last successful snapshot, normally up to one
day. Repeated failures increase that window.

Native signal pruning does not cascade trace deletion into 90-day logs.
Mastra's store-level `prune()` can log a domain failure without rejecting;
the command therefore requires complete results for every selected table.
Source cleanup uses two `find` commands in the existing Studio image:

```sh
find /data/ingestion-sources -type f -mmin +43200 -delete
find /data/ingestion-sources -depth -mindepth 1 -type d -empty -delete
```

Source files are written once, so their modification time (`mtime`) normally
matches their creation time. A later edit starts a new 30-day period. This
policy applies to all source files, without checking the catalog run status.
SQLite reuses freed pages and does not automatically shrink its file. DuckDB
can reclaim deleted storage at `CHECKPOINT`; its `VACUUM` does not shrink it.
The job does not run a full SQLite `VACUUM` or make a full local database copy.

## Inspect and recover

List snapshots or check the repository through the host wrapper:

```sh
sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh restic snapshots --host eventroam --tag eventroam
sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh restic check
```

To check a full restore manually, select a snapshot ID from the job output or
snapshot list. Use an empty directory on a disk with space for the full snapshot
plus 1 GiB. The host command checks free space before downloading:

```sh
sudo mkdir -p /mnt/eventroam-restore-check
sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh verify SNAPSHOT_ID /mnt/eventroam-restore-check
```

Restic restores with `--verify` and checks restored file contents. The current
application image then checks all five databases. Use a compatible image when
checking an old snapshot; the snapshot tag records its original image ID.
The restored copy remains isolated from the live data files. Remove the restore
directory when it is no longer needed. This manual check does not control local
cleanup. No production restore check is implied by local automated tests.

Use the verified isolated restore under `RESTORE_DIRECTORY/data/` to inspect
the data. For an old trace, restore the selected daily snapshot with restic's
`--include /data/mastra-observability.duckdb` option. Open that copy with a
compatible DuckDB runtime or an isolated Studio. Do not open the live DuckDB
file from another process while Studio runs.

For source pages removed by local cleanup, restore their complete run directory
from a snapshot before removal. Durable reports retain the original source
paths. Restore Markdown and evidence together to those paths, or map the same
paths inside an isolated inspection container. Catalog reports are not deleted
when their source files expire.

For full recovery, stop database users and hold the maintenance lock. Restore
a complete snapshot to an isolated directory first, check it, and then replace
the five data files and source tree together. Preserve the originals until the
recovered application passes checks. Remove obsolete WAL and SHM files only
after all users are stopped. Set data ownership to UID/GID 1000, start a
compatible image, and check health and saved-run inspection before new work.

After a host crash or a forced job kill, inspect the Komodo output and any
`eventroam-backup-job` container before restarting writers. Confirm that no
maintenance process remains. Clear a stale pause file with:

```sh
sudo bash /etc/komodo/stacks/eventroam/scripts/backup.sh resume
```

This command does not need S3 access or start services. Use Komodo to restore
the intended service state. Do not clear a restic lock until its previous
process has ended.

## Local checks

Run the focused retention and pause tests with
`pnpm exec vitest run src/backup src/mastra/maintenance.test.ts`.
`pnpm run docker:smoke` checks the built maintenance command, Studio drain,
and a real restic backup and restore. It uses an isolated Compose project and
a local repository. Cleanup runs after backup without a prior restore check.
The manual restore check rejects a corrupt database. Run `pnpm run test:backup`
to check the host script's backup order and confirm that an incomplete upload
skips cleanup and restarts the services. CI runs these two host script tests.

## References

- [Restic backup](https://restic.readthedocs.io/en/stable/040_backup.html)
- [Restic S3 setup](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#amazon-s3)
- [Restic empty passwords](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#repositories-with-empty-password)
- [Restic retention](https://restic.readthedocs.io/en/stable/060_forget.html)
- [Restic restore](https://restic.readthedocs.io/en/stable/050_restore.html)
- [Mastra retention](https://mastra.ai/reference/storage/retention)
- [Compose temporary tasks](https://docs.docker.com/reference/cli/docker/compose/run/)
- [Docker log rotation](https://docs.docker.com/engine/logging/drivers/json-file/)

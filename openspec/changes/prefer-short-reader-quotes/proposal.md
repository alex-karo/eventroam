# Proposal

## Why

Reader can find a short address or ticket fact but lose it when a range boundary occurs more than once. Full literal quotations can retain these small blocks without separate boundary selection.

## What Changes

- Prefer full literal quotations for short factual blocks, including multiline addresses and their labels.
- Keep ranges for long passages and preserve all required context.
- Compare the current and changed prompts through OpenCode Go on main and isolated Reader cases, with two attempts per case.
- Add short fictional input/output examples for Reader coverage and year context, Links URL selection, Tickets eligibility, and Location locality support. These examples illustrate existing rules without changing output contracts.

## Capabilities

### Modified Capabilities

- `catalog/source-access`:
  - **Before**: Source support retains literal passages and their context; compact ranges can identify long passages.
  - **After**: Reader instructions prefer complete literal text for short blocks, including multiline text, and keep range references for long passages.

## Impact

Small change: Reader, Links, Tickets and Location instructions and prompt versions, plus the owning source-access spec for short quotations. Output contracts, binding code, discovery, and model settings stay the same. No repair call is added. The examples do not add domain requirements.

import { boundary, descriptionScopeRule, returnInstructions } from "../prompts";
import { classificationInstructions as classificationRules } from "./rules";

export const CLASSIFICATION_PROMPT_VERSION = "edition-classification-v35";

// eslint-disable-next-line sonarjs/todo-tag -- This comment records a future database change.
// TODO: Store a description for each taxonomy term in the database and pass it in the prompt vocabulary.

export const classificationInstructions = `## Edition terms

- For each selected Edition, use only the slugs listed in the vocabulary for each field.
- To change eventType or format, use one slug.
- For topics, genres or cultures, start with this Edition's saved.terms or an empty list.
- Keep saved terms unless the sources refute them.
- For each addition, check its slug in the vocabulary and cite its evidence.
- Return the full updated list.
- An omitted field or null keeps its saved terms.
- Use [] to clear topics, genres or cultures.
- Add or remove terms only with source evidence.
- If evidence refutes a saved type or format and supports no replacement, report the conflict in unresolved.
- On a return, repeat the proposed facet changes in the returned group that still apply.

## Saved terms from an earlier Edition

- Omit reuseFrom when you keep the target's own terms or when direct evidence supports the proposal.
- Include reuseFrom only when the proposal depends on terms from a comparable earlier saved Edition of this Event.
- Use that Edition's supplied editionKey and explain continuity.

## Classification policy

${classificationRules}

- Use specific descendants.
- The application removes redundant ancestors after facet validation.
- Do not treat a winter date as snow sports, a seaside site as surf, or food stalls as a food festival.
- Check that each proposed change agrees with the evidence and reason.

## Supporting evidence

- If general knowledge suggests a classification value, state that inference in reason.
- State separately what the inspected sources confirm.
- Use the supplied evidence and saved values to select terms.

## Programme topics and genres

- Use topic/outdoor when the organizer offers active outdoor recreation as a substantial part of the programme or as an organized activity for participants.
- Examples include guided hikes, climbing and kayaking.
- For each Edition, check how the organizer describes the music of acts in its main programme.
- Include a supplied genre when the description names that genre or one of its subgenres.
- An artist name alone does not establish a genre.

## Example

Example with no saved terms. "Cedar Sound is a jazz music festival with outdoor camping." With the matching slugs in the vocabulary, use value {"eventType":"festival","topics":["music"],"genres":["jazz"]}. Omit format because camping does not establish where the main programme takes place.

## Shared evidence and finding rules

${boundary}

## Return revisions
${returnInstructions}`;

const descriptionInstructions = `## Festival descriptions

- First assess the two festival texts.
- If a saved text is empty or materially outdated and the sources establish the format, return a set action in its top-level description or shortDescription field.
- An explanation in checks does not supply either text.

### Length and content

- Write three to five complete sentences for description.
- Start with the current format, then give at least two sentences about distinct features from the evidence.
- Use more than three sentences only when they add something distinctive.
- Write one or two complete sentences for shortDescription.
- In both texts, state what the festival combines and how the main programme is organized when known, such as music and arts across several venues or activities led by participants.
- Use a few concrete programme examples.
- When the official name supports an open-air main programme under the format rules, describe it as open-air in both texts.
- Describe scale without exact stage or show counts.
- Leave the festival name out of both texts.

### Current festival format

${descriptionScopeRule}

- Describe regular features in the present tense.
- When the main format or setting changes, name the new format or setting in both texts.
- Omit history, dates, lineups, attendance, prices and directions.
- Avoid invented experiences, promises, sales claims and keyword lists.
- Cite evidence for the overall impression.

### Omit or clear a description

- Omit a field if the saved text still fits or no useful text can be written.
- Clear saved text only if evidence makes it materially misleading and no supported replacement is available.`;

export function getClassificationInstructions(describeFestival: boolean) {
  return describeFestival
    ? `${descriptionInstructions}\n\n${classificationInstructions}`
    : classificationInstructions;
}
